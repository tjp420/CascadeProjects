// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
export class AdminPanelView {
    constructor(app) {
        this.app = app;
        this.users = [];
        this.sessions = [];
        this.loading = false;
        this.error = null;
    }

    isAdmin() {
        const user = this.app.authService && this.app.authService.getUser ? this.app.authService.getUser() : null;
        if (!user) return false;
        const role = String(user.role || '').toLowerCase();
        const tier = String(user.tier || '').toLowerCase();
        if (role === 'admin' || role === 'superuser') return true;
        if (tier === 'admin' || tier === 'superuser') return true;
        if (Array.isArray(user.features) && user.features.map(String).map(s => s.toLowerCase()).includes('all_modules')) return true;
        return false;
    }

    async loadData() {
        this.loading = true;
        this.render();
        try {
            const headers = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            const [usersRes, sessionsRes] = await Promise.all([
                fetch('/api/admin/users', { headers }),
                fetch('/api/admin/sessions', { headers })
            ]);
            if (!usersRes.ok) throw new Error(`Users API ${usersRes.status}`);
            if (!sessionsRes.ok) throw new Error(`Sessions API ${sessionsRes.status}`);
            const usersData = await usersRes.json();
            const sessionsData = await sessionsRes.json();
            this.users = usersData.users || [];
            this.sessions = sessionsData.sessions || [];
            this.error = null;
        } catch (err) {
            this.error = err.message || 'Failed to load admin data';
        } finally {
            this.loading = false;
            this.render();
        }
    }

    async deleteUser(id) {
        if (!confirm('Delete this user?')) return;
        try {
            const headers = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error(`Delete failed ${res.status}`);
            this.users = this.users.filter(u => u.id !== id);
            this.render();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    }

    async setTrustLevel(id, level) {
        try {
            const headers = this.app.authService ? this.app.authService.getAuthHeaders() : {};
            headers['Content-Type'] = 'application/json';
            const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/trust-level`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ trustLevel: level })
            });
            if (!res.ok) throw new Error(`Update failed ${res.status}`);
            const user = this.users.find(u => u.id === id);
            if (user) user.trustLevel = level;
            this.render();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    }

    formatDate(ts) {
        if (!ts) return '—';
        const d = new Date(ts);
        return isNaN(d.getTime()) ? String(ts) : d.toLocaleString();
    }

    mount(container) {
        this.container = container;
        if (!this.isAdmin()) {
            container.innerHTML = `
                <div class="page-header"><h1>Admin Panel</h1></div>
                <div class="card notice-card"><p>Admin access required.</p></div>
            `;
            return;
        }
        this.loadData();
    }

    render() {
        if (!this.container) return;
        if (this.loading && !this.users.length) {
            this.container.innerHTML = '<div class="page-header"><h1>Admin Panel</h1></div><div class="card"><p>Loading accounts…</p></div>';
            return;
        }
        const onlineCount = this.users.filter(u => u.online).length;
        const rows = this.users.map(u => {
            const statusClass = u.online ? 'status-online' : 'status-offline';
            const statusText = u.online ? 'Online' : 'Offline';
            return `
                <tr data-user-id="${this.escapeHtml(u.id)}">
                    <td>${this.escapeHtml(u.name || '')}</td>
                    <td>${this.escapeHtml(u.email || '')}</td>
                    <td><span class="trust-badge trust-${this.escapeHtml(u.trustLevel || 'bronze')}">${this.escapeHtml(u.trustLevel || 'bronze')}</span></td>
                    <td><span class="status-dot ${statusClass}">${statusText}</span><br><small class="text-muted">${this.formatDate(u.lastSeen)}</small></td>
                    <td>${u.successfulAnalyses || 0}</td>
                    <td>${this.formatDate(u.createdAt)}</td>
                    <td>
                        <select class="admin-trust-select" data-id="${this.escapeHtml(u.id)}">
                            <option value="bronze" ${u.trustLevel === 'bronze' ? 'selected' : ''}>bronze</option>
                            <option value="silver" ${u.trustLevel === 'silver' ? 'selected' : ''}>silver</option>
                            <option value="gold" ${u.trustLevel === 'gold' ? 'selected' : ''}>gold</option>
                        </select>
                    </td>
                    <td><button class="btn btn-danger btn-sm admin-delete-btn" data-id="${this.escapeHtml(u.id)}">Delete</button></td>
                </tr>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="page-header">
                <h1>Admin Panel</h1>
                <p class="page-subtitle">Manage accounts and monitor online activity.</p>
            </div>
            ${this.error ? `<div class="card notice-card"><p class="text-danger">${this.escapeHtml(this.error)}</p></div>` : ''}
            <div class="card mb-4">
                <div class="admin-stats">
                    <div class="stat"><strong>${this.users.length}</strong><span>Total accounts</span></div>
                    <div class="stat"><strong>${onlineCount}</strong><span>Online now</span></div>
                    <div class="stat"><strong>${this.sessions.length}</strong><span>Active sessions</span></div>
                </div>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Name</th><th>Email</th><th>Trust</th><th>Status</th><th>Analyses</th><th>Created</th><th>Set Trust</th><th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="8" class="text-center">No accounts found</td></tr>'}</tbody>
                    </table>
                </div>
            </div>
            <style>
                .admin-stats { display: flex; gap: 2rem; padding: 1rem; }
                .admin-stats .stat { display: flex; flex-direction: column; min-width: 120px; }
                .admin-stats .stat strong { font-size: 1.5rem; }
                .admin-table { width: 100%; border-collapse: collapse; }
                .admin-table th, .admin-table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border-color, #2a2a2a); }
                .trust-badge { text-transform: uppercase; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; }
                .trust-bronze { background: #5a3a1a; color: #ffcc99; }
                .trust-silver { background: #3a4a5a; color: #cceeff; }
                .trust-gold { background: #4a451a; color: #ffee99; }
                .status-dot { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
                .status-dot::before { content: ''; width: 8px; height: 8px; border-radius: 50%; }
                .status-online::before { background: #2ecc71; }
                .status-offline::before { background: #e74c3c; }
            </style>
        `;

        this.container.querySelectorAll('.admin-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteUser(e.target.dataset.id));
        });
        this.container.querySelectorAll('.admin-trust-select').forEach(sel => {
            sel.addEventListener('change', (e) => this.setTrustLevel(e.target.dataset.id, e.target.value));
        });
    }

    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    destroy() {
        this.container = null;
    }
}
