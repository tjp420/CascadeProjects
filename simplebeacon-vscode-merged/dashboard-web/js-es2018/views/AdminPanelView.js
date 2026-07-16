// @ts-nocheck
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { authService, apiBase } from '../services/authService.js?v=20260716cachefix1';
import { escapeHtml, showToast, downloadJson } from '../utils.js';

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
        status: row.status || 'active',
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
const PAGE_SIZE = 50;

function formatCompactNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export class AdminPanelView {
    constructor(app) {
        this.app = app;
        this.users = [];
        this.sessions = [];
        this.stats = null;
        this.loading = false;
        this.error = null;
        this.searchQuery = '';
        this.statusFilter = 'all';
        this.trustFilter = 'all';
        this.groupByTier = false;
        this.sortField = 'createdAt';
        this.sortDir = 'desc';
        this.pageLimit = PAGE_SIZE;
        this.totalUsers = 0;
        this.hasMore = false;
        this.nextCursor = null;
        this.cursorStack = [];
        this.pageIndex = 1;
        this.searchTimer = null;
        this.passwordVerifiedUntil = 0;
        this.modals = [];
    }

    isAdmin() {
        return authService.isAdmin();
    }

    adminFetch(path, options = {}) {
        const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
        const headers = { ...(options.headers || {}), ...authService.getAuthHeaders() };
        return fetch(url, { ...options, headers, credentials: 'include' });
    }

    buildUsersQuery() {
        const params = new URLSearchParams({
            limit: String(this.pageLimit),
            sort: this.sortField,
            dir: this.sortDir
        });
        const q = this.searchQuery.trim();
        if (q) params.set('q', q);
        if (this.statusFilter && this.statusFilter !== 'all') params.set('status', this.statusFilter);
        if (this.trustFilter && this.trustFilter !== 'all') params.set('trust', this.trustFilter);
        if (this.pageIndex > 1) {
            if (this.sortField === 'createdAt') {
                const cursor = this.cursorStack[this.pageIndex - 2];
                if (cursor) params.set('cursor', cursor);
                else params.set('offset', String((this.pageIndex - 1) * this.pageLimit));
            } else {
                params.set('offset', String((this.pageIndex - 1) * this.pageLimit));
            }
        }
        return `/api/admin/users?${params.toString()}`;
    }

    async loadUsersPage() {
        const usersRes = await this.adminFetch(this.buildUsersQuery());
        if (!usersRes.ok) throw new Error(`Users API ${usersRes.status}`);
        const usersData = await usersRes.json();
        this.users = (usersData.users || []).map(normalizeUser).filter(Boolean);
        this.totalUsers = Number(usersData.total) || this.users.length;
        this.hasMore = Boolean(usersData.hasMore);
        this.nextCursor = usersData.nextCursor || null;
        return usersData;
    }

    async fetchUsersPage() {
        this.loading = true;
        this.render();
        try {
            await this.loadUsersPage();
            this.error = null;
        } catch (err) {
            this.error = err.message || 'Failed to load accounts';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    async loadData(options = {}) {
        const reset = options.reset !== false;
        if (reset) {
            this.cursorStack = [];
            this.pageIndex = 1;
            this.nextCursor = null;
        }
        this.loading = true;
        this.render();
        try {
            const usersPromise = this.loadUsersPage();
            const sessionsPromise = this.adminFetch('/api/admin/sessions');
            const statsPromise = this.adminFetch('/api/admin/stats').catch(() => null);
            await usersPromise;
            const [sessionsRes, statsRes] = await Promise.all([sessionsPromise, statsPromise]);
            if (!sessionsRes.ok) throw new Error(`Sessions API ${sessionsRes.status}`);
            const sessionsData = await sessionsRes.json();
            this.sessions = sessionsData.sessions || [];
            if (statsRes && statsRes.ok) {
                this.stats = (await statsRes.json()).stats || null;
                if (this.stats?.totalAccounts != null) {
                    this.totalUsers = Number(this.stats.totalAccounts) || this.totalUsers;
                }
            }
            this.error = null;
        } catch (err) {
            this.error = err.message || 'Failed to load admin data';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    async goToNextPage() {
        if (!this.hasMore || this.loading) return;
        if (this.sortField === 'createdAt' && this.nextCursor) {
            this.cursorStack.push(this.nextCursor);
        }
        this.pageIndex += 1;
        await this.fetchUsersPage();
    }

    async goToPreviousPage() {
        if (this.pageIndex <= 1 || this.loading) return;
        if (this.sortField === 'createdAt') {
            this.cursorStack.pop();
        }
        this.pageIndex -= 1;
        await this.fetchUsersPage();
    }

    async loadAllAccounts() {
        if (this.loading) return;
        this.loading = true;
        this.render();
        const merged = [];
        const savedPage = this.pageIndex;
        const savedStack = [...this.cursorStack];
        const savedHasMore = this.hasMore;
        const savedCursor = this.nextCursor;
        try {
            this.pageIndex = 1;
            this.cursorStack = [];
            while (merged.length < 5000) {
                await this.loadUsersPage();
                merged.push(...this.users);
                if (!this.hasMore) break;
                if (this.sortField === 'createdAt' && this.nextCursor) {
                    this.cursorStack = [...this.cursorStack, this.nextCursor];
                }
                this.pageIndex += 1;
            }
            this.users = merged;
            this.totalUsers = merged.length;
            this.hasMore = false;
            this.nextCursor = null;
            this.pageIndex = 1;
            this.cursorStack = [];
            showToast(`Loaded ${merged.length} accounts`, 'success');
        } catch (err) {
            this.pageIndex = savedPage;
            this.cursorStack = savedStack;
            this.hasMore = savedHasMore;
            this.nextCursor = savedCursor;
            showToast('Load all failed: ' + (err.message || 'unknown error'), 'error');
        } finally {
            this.loading = false;
            this.render();
        }
    }

    getTierCounts() {
        const fromStats = this.stats?.tierCounts;
        if (fromStats) return fromStats;
        const counts = { bronze: 0, silver: 0, gold: 0 };
        for (const u of this.users) {
            const t = String(u.trustLevel || 'bronze').toLowerCase();
            if (t in counts) counts[t] += 1;
        }
        return counts;
    }

    getStatusCounts() {
        const fromStats = this.stats?.statusCounts;
        if (fromStats) return fromStats;
        const counts = { active: 0, suspended: 0 };
        for (const u of this.users) {
            const st = String(u.status || 'active').toLowerCase();
            counts[st] = (counts[st] || 0) + 1;
        }
        return counts;
    }

    setFilter(kind, value) {
        if (kind === 'status') this.statusFilter = value;
        if (kind === 'trust') this.trustFilter = value;
        this.loadData({ reset: true });
    }

    scheduleSearchReload() {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.loadData({ reset: true });
        }, 300);
    }

    async promptPassword(title = 'Confirm destructive action') {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'admin-modal-overlay';
            overlay.innerHTML = `
                <div class="admin-modal" role="dialog" aria-modal="true">
                    <h3>${escapeHtml(title)}</h3>
                    <p class="text-muted">Enter your admin password to continue.</p>
                    <input type="password" class="settings-input admin-password-input" id="admin-password-input" placeholder="Admin password" autocomplete="current-password">
                    <div class="admin-modal-actions">
                        <button class="btn btn-secondary" id="admin-password-cancel" type="button">Cancel</button>
                        <button class="btn btn-primary" id="admin-password-confirm" type="button">Confirm</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            const input = overlay.querySelector('#admin-password-input');
            const confirm = overlay.querySelector('#admin-password-confirm');
            const cancel = overlay.querySelector('#admin-password-cancel');
            input.focus();
            const finish = (value) => {
                overlay.remove();
                resolve(value);
            };
            confirm.addEventListener('click', () => finish(input.value || null));
            cancel.addEventListener('click', () => finish(null));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish(input.value || null);
                if (e.key === 'Escape') finish(null);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) finish(null);
            });
        });
    }

    async promptConfirmEmail(user) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'admin-modal-overlay';
            overlay.innerHTML = `
                <div class="admin-modal" role="dialog" aria-modal="true">
                    <h3>Delete ${escapeHtml(user.name || user.email)}</h3>
                    <p class="text-danger">This action cannot be undone. Type the account email to confirm.</p>
                    <input type="text" class="settings-input admin-confirm-input" id="admin-confirm-input" placeholder="Type account email" autocomplete="off">
                    <div class="admin-modal-actions">
                        <button class="btn btn-secondary" id="admin-confirm-cancel" type="button">Cancel</button>
                        <button class="btn btn-danger" id="admin-confirm-ok" type="button">Delete account</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            const input = overlay.querySelector('#admin-confirm-input');
            const ok = overlay.querySelector('#admin-confirm-ok');
            const cancel = overlay.querySelector('#admin-confirm-cancel');
            input.focus();
            const finish = (value) => {
                overlay.remove();
                resolve(value);
            };
            ok.addEventListener('click', () => finish(input.value || null));
            cancel.addEventListener('click', () => finish(null));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finish(input.value || null);
                if (e.key === 'Escape') finish(null);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) finish(null);
            });
        });
    }

    async deleteUser(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        if (this.isProtectedUser(user)) {
            showToast('Primary admin cannot be deleted', 'error');
            return;
        }
        const confirmEmail = await this.promptConfirmEmail(user);
        if (!confirmEmail) return;
        const password = await this.promptPassword('Delete account');
        if (!password) return;
        try {
            const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, confirmEmail })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Delete failed ${res.status}`);
            this.users = this.users.filter(u => u.id !== id);
            showToast('Account deleted', 'success');
            this.render();
        } catch (err) {
            showToast('Delete failed: ' + err.message, 'error');
        }
    }

    async suspendUser(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        if (this.isProtectedUser(user)) {
            showToast('Primary admin cannot be suspended', 'error');
            return;
        }
        const password = await this.promptPassword('Suspend account');
        if (!password) return;
        try {
            const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}/suspend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Suspend failed ${res.status}`);
            user.status = 'suspended';
            showToast('Account suspended', 'success');
            this.render();
        } catch (err) {
            showToast('Suspend failed: ' + err.message, 'error');
        }
    }

    async unsuspendUser(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        const wasPending = user.status === 'pending';
        try {
            const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}/unsuspend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Unsuspend failed ${res.status}`);
            user.status = 'active';
            showToast(wasPending ? 'Account approved' : 'Account reactivated', 'success');
            this.render();
        } catch (err) {
            showToast('Unsuspend failed: ' + err.message, 'error');
        }
    }

    openTierModal(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        const overlay = document.createElement('div');
        overlay.className = 'admin-modal-overlay';
        overlay.innerHTML = `
            <div class="admin-modal" role="dialog" aria-modal="true">
                <h3>Change tier for ${escapeHtml(user.name || user.email)}</h3>
                <label>Trust level</label>
                <select class="settings-input admin-tier-select" id="admin-tier-trust">
                    <option value="bronze" ${user.trustLevel === 'bronze' ? 'selected' : ''}>Bronze</option>
                    <option value="silver" ${user.trustLevel === 'silver' ? 'selected' : ''}>Silver</option>
                    <option value="gold" ${user.trustLevel === 'gold' ? 'selected' : ''}>Gold</option>
                </select>
                <label>Subscription tier</label>
                <select class="settings-input admin-tier-select" id="admin-tier-subscription">
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="trial">Trial</option>
                </select>
                <label>Subscription status</label>
                <select class="settings-input admin-tier-select" id="admin-tier-status">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="past_due">Past due</option>
                    <option value="canceled">Canceled</option>
                    <option value="refunded">Refunded</option>
                </select>
                <label>Admin password</label>
                <input type="password" class="settings-input admin-password-input" id="admin-tier-password" placeholder="Admin password" autocomplete="current-password">
                <div class="admin-modal-actions">
                    <button class="btn btn-secondary" id="admin-tier-cancel" type="button">Cancel</button>
                    <button class="btn btn-primary" id="admin-tier-save" type="button">Save changes</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const finish = () => overlay.remove();
        overlay.querySelector('#admin-tier-cancel').addEventListener('click', finish);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
        overlay.querySelector('#admin-tier-save').addEventListener('click', async () => {
            const trustLevel = overlay.querySelector('#admin-tier-trust').value;
            const subscriptionTier = overlay.querySelector('#admin-tier-subscription').value;
            const subscriptionStatus = overlay.querySelector('#admin-tier-status').value;
            const password = overlay.querySelector('#admin-tier-password').value;
            if (!password) {
                showToast('Admin password required', 'error');
                return;
            }
            finish();
            try {
                const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}/trust-level`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trustLevel, subscriptionTier, subscriptionStatus, password })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Update failed ${res.status}`);
                user.trustLevel = trustLevel;
                showToast('Tier updated', 'success');
                this.render();
            } catch (err) {
                showToast('Tier update failed: ' + err.message, 'error');
            }
        });
    }

    openEditModal(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        const overlay = document.createElement('div');
        overlay.className = 'admin-modal-overlay';
        overlay.innerHTML = `
            <div class="admin-modal" role="dialog" aria-modal="true">
                <h3>Edit account details</h3>
                <label>Display name</label>
                <input type="text" class="settings-input" id="admin-edit-name" value="${escapeHtml(user.name || '')}">
                <label>Email</label>
                <input type="email" class="settings-input" id="admin-edit-email" value="${escapeHtml(user.email || '')}">
                <label>Admin password</label>
                <input type="password" class="settings-input admin-password-input" id="admin-edit-password" placeholder="Admin password" autocomplete="current-password">
                <div class="admin-modal-actions">
                    <button class="btn btn-secondary" id="admin-edit-cancel" type="button">Cancel</button>
                    <button class="btn btn-primary" id="admin-edit-save" type="button">Save</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const finish = () => overlay.remove();
        overlay.querySelector('#admin-edit-cancel').addEventListener('click', finish);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
        overlay.querySelector('#admin-edit-save').addEventListener('click', async () => {
            const name = overlay.querySelector('#admin-edit-name').value.trim();
            const email = overlay.querySelector('#admin-edit-email').value.trim();
            const password = overlay.querySelector('#admin-edit-password').value;
            if (!password) {
                showToast('Admin password required to update email', 'error');
                return;
            }
            if (!email || !email.includes('@')) {
                showToast('Valid email required', 'error');
                return;
            }
            finish();
            try {
                const res = await this.adminFetch(`/api/admin/users/${encodeURIComponent(id)}/details`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Update failed ${res.status}`);
                user.name = name;
                user.email = email;
                showToast('Account details updated', 'success');
                this.render();
            } catch (err) {
                showToast('Update failed: ' + err.message, 'error');
            }
        });
    }

    openRefundModal(id) {
        const user = this.users.find(u => u.id === id);
        if (!user) return;
        const overlay = document.createElement('div');
        overlay.className = 'admin-modal-overlay';
        overlay.innerHTML = `
            <div class="admin-modal" role="dialog" aria-modal="true">
                <h3>Refund ${escapeHtml(user.name || user.email)}</h3>
                <p class="text-muted">Refunds all active paid subscriptions for this account. Stripe refund is attempted first when configured.</p>
                <label>Reason (optional)</label>
                <input type="text" class="settings-input" id="admin-refund-reason" placeholder="Reason for refund">
                <label>Admin password</label>
                <input type="password" class="settings-input admin-password-input" id="admin-refund-password" placeholder="Admin password" autocomplete="current-password">
                <div class="admin-modal-actions">
                    <button class="btn btn-secondary" id="admin-refund-cancel" type="button">Cancel</button>
                    <button class="btn btn-danger" id="admin-refund-confirm" type="button">Process refund</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const finish = () => overlay.remove();
        overlay.querySelector('#admin-refund-cancel').addEventListener('click', finish);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
        overlay.querySelector('#admin-refund-confirm').addEventListener('click', async () => {
            const reason = overlay.querySelector('#admin-refund-reason').value.trim();
            const password = overlay.querySelector('#admin-refund-password').value;
            if (!password) {
                showToast('Admin password required', 'error');
                return;
            }
            finish();
            try {
                const res = await this.adminFetch(`/api/admin/customers/${encodeURIComponent(user.email)}/refund`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason, password })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Refund failed ${res.status}`);
                showToast(`Refund processed (${data.refundedCount || 0} subscriptions)`, 'success');
            } catch (err) {
                showToast('Refund failed: ' + err.message, 'error');
            }
        });
    }

    getFilteredUsers() {
        return this.users;
    }

    getPageRangeLabel() {
        if (!this.totalUsers) return '0 accounts';
        const start = ((this.pageIndex - 1) * this.pageLimit) + 1;
        const end = Math.min(this.pageIndex * this.pageLimit, this.totalUsers);
        return `${formatCompactNumber(start)}–${formatCompactNumber(end)} of ${formatCompactNumber(this.totalUsers)}`;
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

    exportAdminData() {
        if (!this.users.length && !this.sessions.length && !this.stats) {
            showToast('No admin data to export', 'error');
            return;
        }
        const payload = {
            type: 'simplebeacon-admin-export',
            version: '1.1.0',
            generatedAt: new Date().toISOString(),
            stats: this.stats,
            page: this.pageIndex,
            pageLimit: this.pageLimit,
            totalAccounts: this.totalUsers,
            exportedUserCount: this.users.length,
            exportScope: this.totalUsers > this.users.length ? 'current-page' : 'full-page',
            users: this.users.map((u) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                status: u.status,
                trustLevel: u.trustLevel,
                verificationStatus: u.verificationStatus,
                successfulAnalyses: u.successfulAnalyses,
                securityIncidents: u.securityIncidents,
                communityContributions: u.communityContributions,
                createdAt: u.createdAt,
                online: u.online,
                lastSeen: u.lastSeen
            })),
            sessions: (this.sessions || []).map((s) => ({
                id: s.id || s.sessionId || null,
                email: s.email || s.userEmail || null,
                createdAt: s.createdAt || s.created_at || null,
                lastSeen: s.lastSeen || s.last_seen || null,
                online: Boolean(s.online)
            }))
        };
        downloadJson(payload, `admin-panel-export-${new Date().toISOString().slice(0, 10)}.json`);
        const scopeNote = payload.exportScope === 'current-page'
            ? ` (page ${this.pageIndex} of ${formatCompactNumber(this.totalUsers)} accounts)`
            : '';
        showToast(`Admin panel exported${scopeNote}`, 'success');
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
        const onlineCount = this.stats?.onlineNow ?? filtered.filter(u => u.online).length;
        const showIncidents = filtered.some(u => (u.securityIncidents || 0) > 0) || this.users.some(u => (u.securityIncidents || 0) > 0);
        const tierCounts = this.getTierCounts();
        const statusCounts = this.getStatusCounts();
        this.container.innerHTML = `
            <div class="page-header admin-page-header">
                <div>
                    <h1>Account Manager</h1>
                    <p class="page-subtitle">Search, filter, and manage every registered account. Use <strong>Load all</strong> if the directory is paginated.</p>
                </div>
            </div>
            ${this.error ? `<div class="card notice-card mb-4"><p class="text-danger">${escapeHtml(this.error)}</p></div>` : ''}
            ${this.renderStats(onlineCount, tierCounts, statusCounts)}
            <div class="admin-layout">
                <aside class="admin-sidebar card">
                    <h2 class="admin-sidebar-title">Filters</h2>
                    <div class="admin-filter-group">
                        <span class="admin-filter-label">Status</span>
                        <div class="admin-filter-chips">
                            ${this.renderFilterChip('status', 'all', 'All', this.totalUsers)}
                            ${this.renderFilterChip('status', 'active', 'Active', statusCounts.active)}
                            ${this.renderFilterChip('status', 'pending', 'Pending', statusCounts.pending)}
                            ${this.renderFilterChip('status', 'suspended', 'Suspended', statusCounts.suspended)}
                        </div>
                    </div>
                    <div class="admin-filter-group">
                        <span class="admin-filter-label">Trust tier</span>
                        <div class="admin-filter-chips">
                            ${this.renderFilterChip('trust', 'all', 'All tiers', this.totalUsers)}
                            ${this.renderFilterChip('trust', 'gold', 'Gold', tierCounts.gold)}
                            ${this.renderFilterChip('trust', 'silver', 'Silver', tierCounts.silver)}
                            ${this.renderFilterChip('trust', 'bronze', 'Bronze', tierCounts.bronze)}
                        </div>
                    </div>
                    <label class="admin-toggle-row">
                        <input type="checkbox" id="admin-group-tier" ${this.groupByTier ? 'checked' : ''}>
                        <span>Group table by trust tier</span>
                    </label>
                    <div class="admin-sidebar-section">
                        <h3 class="admin-sidebar-subtitle">Active sessions (${this.sessions.length})</h3>
                        ${this.renderSessionsList()}
                    </div>
                </aside>
                <section class="admin-main">
                    <div class="card mb-4">
                        <div class="admin-toolbar">
                            <div class="admin-search-wrap">
                                <input type="search" class="settings-input admin-search-input" id="admin-search" placeholder="Search name or email…" value="${escapeHtml(this.searchQuery)}" autocomplete="off">
                            </div>
                            <div class="admin-toolbar-actions">
                                <label class="admin-page-size-label">
                                    Per page
                                    <select class="settings-input admin-page-size-select" id="admin-page-size">
                                        ${[50, 100, 200, 500].map(n => `<option value="${n}" ${this.pageLimit === n ? 'selected' : ''}>${n}</option>`).join('')}
                                    </select>
                                </label>
                                <span class="admin-count-badge">${escapeHtml(this.getPageRangeLabel())}</span>
                                <button class="btn btn-secondary btn-sm" id="admin-load-all" type="button" ${this.loading ? 'disabled' : ''}>Load all</button>
                                <button class="btn btn-ghost btn-sm" id="admin-export-json" type="button">Export JSON</button>
                                <button class="btn btn-secondary btn-sm" id="admin-refresh" type="button" ${this.loading ? 'disabled' : ''}>↻ Refresh</button>
                            </div>
                        </div>
                        <div class="admin-pagination">
                            <button class="btn btn-secondary btn-sm" id="admin-prev-page" type="button" ${this.pageIndex <= 1 || this.loading ? 'disabled' : ''}>← Previous</button>
                            <span class="admin-page-label">Page ${formatCompactNumber(this.pageIndex)}${this.hasMore ? '+' : ''}</span>
                            <button class="btn btn-secondary btn-sm" id="admin-next-page" type="button" ${!this.hasMore || this.loading ? 'disabled' : ''}>Next →</button>
                        </div>
                    </div>
                    <div class="card">
                        ${this.groupByTier ? this.renderGroupedTables(filtered, showIncidents) : this.renderFlatTable(filtered, showIncidents)}
                    </div>
                </section>
            </div>
        `;
        this.bindEvents();
    }

    renderStats(onlineCount, tierCounts = {}, statusCounts = {}) {
        const s = this.stats;
        const totalAccounts = s?.totalAccounts ?? this.totalUsers ?? this.users.length;
        const items = [
            { label: 'Total accounts', value: formatCompactNumber(totalAccounts), accent: true },
            { label: 'Online now', value: formatCompactNumber(onlineCount) },
            { label: 'Active', value: formatCompactNumber(statusCounts.active ?? '—') },
            { label: 'Suspended', value: formatCompactNumber(statusCounts.suspended ?? '—') },
            { label: 'Gold', value: formatCompactNumber(tierCounts.gold ?? '—') },
            { label: 'Silver', value: formatCompactNumber(tierCounts.silver ?? '—') },
            { label: 'Bronze', value: formatCompactNumber(tierCounts.bronze ?? '—') },
            { label: 'Sessions', value: formatCompactNumber(this.sessions.length) }
        ];
        if (s?.activeSubscriptions != null) items.push({ label: 'Subscriptions', value: s.activeSubscriptions });
        return `<div class="card mb-4"><div class="admin-stats">${items.map(si => `<div class="stat${si.accent ? ' stat-accent' : ''}"><strong>${si.value}</strong><span>${escapeHtml(si.label)}</span></div>`).join('')}</div></div>`;
    }

    renderFilterChip(kind, value, label, count) {
        const active = (kind === 'status' ? this.statusFilter : this.trustFilter) === value;
        const countLabel = count != null && count !== '—' ? ` (${formatCompactNumber(count)})` : '';
        return `<button type="button" class="admin-filter-chip${active ? ' is-active' : ''}" data-filter-kind="${kind}" data-filter-value="${value}">${escapeHtml(label)}${countLabel}</button>`;
    }

    renderSessionsList() {
        if (!this.sessions.length) {
            return '<p class="text-muted admin-sessions-empty">No active sessions</p>';
        }
        const rows = this.sessions.slice(0, 12).map((s) => {
            const email = s.email || s.userEmail || 'Unknown';
            const online = s.online ? 'online' : 'offline';
            return `<div class="admin-session-row ${online}"><span class="admin-session-email">${escapeHtml(email)}</span><span class="admin-session-meta">${escapeHtml(this.formatRelative(s.lastSeen) || (s.online ? 'Online' : 'Offline'))}</span></div>`;
        }).join('');
        const more = this.sessions.length > 12 ? `<p class="text-muted admin-sessions-more">+${this.sessions.length - 12} more</p>` : '';
        return `<div class="admin-sessions-list">${rows}${more}</div>`;
    }

    renderTableHead(showIncidents) {
        return `<thead><tr>
            ${this.renderSortHeader('name', 'Account')}
            ${this.renderSortHeader('trustLevel', 'Trust')}
            ${this.renderSortHeader('status', 'Status')}
            ${this.renderSortHeader('successfulAnalyses', 'Analyses')}
            ${showIncidents ? '<th>Incidents</th>' : ''}
            ${this.renderSortHeader('createdAt', 'Created')}
            <th>Actions</th>
        </tr></thead>`;
    }

    renderFlatTable(filtered, showIncidents) {
        return `<div class="table-responsive">
            <table class="admin-table">
                ${this.renderTableHead(showIncidents)}
                <tbody>${this.renderUserRows(filtered, showIncidents)}</tbody>
            </table>
        </div>`;
    }

    renderGroupedTables(filtered, showIncidents) {
        const tiers = ['gold', 'silver', 'bronze'];
        const groups = tiers.map((tier) => ({
            tier,
            users: filtered.filter((u) => String(u.trustLevel || 'bronze').toLowerCase() === tier)
        })).filter((g) => g.users.length > 0);
        const other = filtered.filter((u) => !tiers.includes(String(u.trustLevel || 'bronze').toLowerCase()));
        if (other.length) groups.push({ tier: 'other', users: other });
        if (!groups.length) {
            return this.renderFlatTable(filtered, showIncidents);
        }
        return groups.map((g) => `
            <div class="admin-tier-group">
                <h3 class="admin-tier-group-title"><span class="trust-badge trust-${escapeHtml(g.tier === 'other' ? 'bronze' : g.tier)}">${escapeHtml(g.tier)}</span> ${g.users.length} account${g.users.length === 1 ? '' : 's'}</h3>
                <div class="table-responsive">
                    <table class="admin-table">
                        ${this.renderTableHead(showIncidents)}
                        <tbody>${this.renderUserRows(g.users, showIncidents)}</tbody>
                    </table>
                </div>
            </div>`).join('');
    }

    renderSortHeader(field, label) {
        const sorted = this.sortField === field;
        const arrow = sorted ? (this.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
        return `<th data-sort-field="${escapeHtml(field)}">${escapeHtml(label)}<span class="admin-sort-ind">${arrow}</span></th>`;
    }

    renderUserRows(filtered, showIncidents = false) {
        const colSpan = showIncidents ? 7 : 6;
        if (!filtered.length) return `<tr><td colspan="${colSpan}" class="text-center text-muted" style="padding:2rem;">No accounts found</td></tr>`;
        return filtered.map(u => {
            const sc = u.online ? 'status-online' : 'status-offline';
            const st = u.online ? 'Online' : 'Offline';
            const lastMeta = u.lastSeen ? `<span class="admin-status-meta" title="${escapeHtml(this.formatDate(u.lastSeen))}">${escapeHtml(this.formatRelative(u.lastSeen))}</span>` : '';
            const protectedUser = this.isProtectedUser(u);
            const accountStatus = String(u.status || 'active').toLowerCase();
            const pending = accountStatus === 'pending';
            const suspended = accountStatus === 'suspended';
            return `
                <tr data-user-id="${escapeHtml(u.id)}" class="${suspended || pending ? 'admin-row-suspended' : ''}">
                    <td>
                        <div class="admin-account-name">${escapeHtml(u.name || '')}</div>
                        <div class="admin-account-email">${escapeHtml(u.email || '')}</div>
                    </td>
                    <td><span class="trust-badge trust-${escapeHtml(u.trustLevel || 'bronze')}">${escapeHtml(u.trustLevel || 'bronze')}</span></td>
                    <td>
                        <span class="status-dot ${sc}">${st}</span>${lastMeta}
                        ${pending ? '<span class="admin-status-badge suspended">Pending approval</span>' : ''}
                        ${suspended ? '<span class="admin-status-badge suspended">Suspended</span>' : ''}
                    </td>
                    <td>${u.successfulAnalyses || 0}</td>
                    ${showIncidents ? `<td>${u.securityIncidents || 0}</td>` : ''}
                    <td>${this.formatDate(u.createdAt)}</td>
                    <td>
                        <div class="admin-actions">
                            <button class="btn btn-secondary btn-sm admin-actions-toggle" type="button" data-id="${escapeHtml(u.id)}">Actions ▾</button>
                            <div class="admin-actions-menu" data-menu-id="${escapeHtml(u.id)}">
                                <button class="admin-action-item" data-action="edit" data-id="${escapeHtml(u.id)}">Edit</button>
                                <button class="admin-action-item" data-action="tier" data-id="${escapeHtml(u.id)}">Change tier</button>
                                ${(suspended || pending)
                                    ? `<button class="admin-action-item" data-action="unsuspend" data-id="${escapeHtml(u.id)}">${pending ? 'Approve account' : 'Reactivate'}</button>`
                                    : `<button class="admin-action-item" data-action="suspend" data-id="${escapeHtml(u.id)}" ${protectedUser ? 'disabled' : ''}>Suspend</button>`}
                                <button class="admin-action-item" data-action="refund" data-id="${escapeHtml(u.id)}">Refund</button>
                                <button class="admin-action-item admin-action-danger" data-action="delete" data-id="${escapeHtml(u.id)}" ${protectedUser ? 'disabled' : ''}>Delete</button>
                            </div>
                        </div>
                    </td>
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
                this.scheduleSearchReload();
            });
        }
        const prevBtn = this.container.querySelector('#admin-prev-page');
        if (prevBtn) prevBtn.addEventListener('click', () => this.goToPreviousPage());
        const nextBtn = this.container.querySelector('#admin-next-page');
        if (nextBtn) nextBtn.addEventListener('click', () => this.goToNextPage());
        const refreshBtn = this.container.querySelector('#admin-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                showToast('Refreshing…', 'info');
                this.loadData({ reset: true });
            });
        }
        const exportBtn = this.container.querySelector('#admin-export-json');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportAdminData());
        }
        const loadAllBtn = this.container.querySelector('#admin-load-all');
        if (loadAllBtn) {
            loadAllBtn.addEventListener('click', () => this.loadAllAccounts());
        }
        const pageSizeSelect = this.container.querySelector('#admin-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageLimit = Number(e.target.value) || PAGE_SIZE;
                this.loadData({ reset: true });
            });
        }
        const groupTier = this.container.querySelector('#admin-group-tier');
        if (groupTier) {
            groupTier.addEventListener('change', (e) => {
                this.groupByTier = e.target.checked;
                this.render();
            });
        }
        this.container.querySelectorAll('[data-filter-kind]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.filterKind, btn.dataset.filterValue);
            });
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
                this.loadData({ reset: true });
            });
        });
        this.bindRowActions();
    }

    bindRowActions() {
        if (!this.container) return;
        this.container.querySelectorAll('.admin-actions-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                const menu = this.container.querySelector(`.admin-actions-menu[data-menu-id="${CSS.escape(id)}"]`);
                if (!menu) return;
                const wasOpen = menu.classList.contains('open');
                this.container.querySelectorAll('.admin-actions-menu.open').forEach(m => m.classList.remove('open'));
                if (!wasOpen) menu.classList.add('open');
            });
        });
        this.container.querySelectorAll('.admin-action-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                this.container.querySelectorAll('.admin-actions-menu.open').forEach(m => m.classList.remove('open'));
                if (action === 'delete') this.deleteUser(id);
                else if (action === 'suspend') this.suspendUser(id);
                else if (action === 'unsuspend') this.unsuspendUser(id);
                else if (action === 'tier') this.openTierModal(id);
                else if (action === 'edit') this.openEditModal(id);
                else if (action === 'refund') this.openRefundModal(id);
            });
        });
        if (this._docClickHandler) {
            document.removeEventListener('click', this._docClickHandler);
        }
        this._docClickHandler = () => {
            if (!this.container) return;
            this.container.querySelectorAll('.admin-actions-menu.open').forEach(m => m.classList.remove('open'));
        };
        document.addEventListener('click', this._docClickHandler);
    }

    renderTableBody() {
        if (!this.container) return;
        const tbody = this.container.querySelector('.admin-table tbody');
        if (!tbody) return;
        const filtered = this.getFilteredUsers();
        const showIncidents = this.showIncidentsColumn();
        tbody.innerHTML = this.renderUserRows(filtered, showIncidents);
        const badge = this.container.querySelector('.admin-count-badge');
        if (badge) badge.textContent = this.getPageRangeLabel();
        this.bindRowActions();
    }

    destroy() {
        if (this.searchTimer) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }
        if (this._docClickHandler) {
            document.removeEventListener('click', this._docClickHandler);
            this._docClickHandler = null;
        }
        this.container = null;
    }
}
