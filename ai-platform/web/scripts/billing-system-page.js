/**
 * Billing System Page — billing and subscription management
 */
(function () {
    const SAMPLE_CACHE_BUST = '20260524ah';
    const SAMPLE_URL = `/data/billing-system-sample.json?v=${SAMPLE_CACHE_BUST}`;
    let revenueChart = null;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isBillingSystemModel(payload) {
        return Boolean(payload && (
            payload.type === 'billing-system-model' ||
            (payload.overview?.totalRevenue != null && Array.isArray(payload.subscriptions))
        ));
    }

    function buildOverview(raw) {
        const useDerived = raw.dataSource === 'repository-audit';
        if (!useDerived) {
            return raw.overview || {};
        }

        const subscriptions = raw.subscriptions || [];
        const billableSubs = subscriptions.filter((plan) => (plan.activeCustomers ?? 0) > 0);
        const totalRevenue = subscriptions.reduce((sum, plan) => sum + (plan.revenue ?? 0), 0);

        return {
            ...(raw.overview || {}),
            totalRevenue: raw.overview?.totalRevenue ?? totalRevenue,
            monthlyRevenue: raw.overview?.monthlyRevenue ?? totalRevenue,
            activeSubscriptions: raw.overview?.activeSubscriptions
                ?? billableSubs.reduce((sum, plan) => sum + (plan.activeCustomers ?? 0), 0),
            churnRate: raw.overview?.churnRate ?? null,
            avgRevenuePerCustomer: raw.overview?.avgRevenuePerCustomer ?? null,
            monthlyGrowth: raw.overview?.monthlyGrowth ?? null
        };
    }

    function normalizeModel(payload) {
        const raw = payload?.data && isBillingSystemModel(payload.data) ? payload.data : payload;
        if (!isBillingSystemModel(raw)) return null;
        return {
            type: raw.type || 'billing-system-model',
            title: raw.title || 'Billing System Report',
            dataSource: raw.dataSource || null,
            generatedAt: raw.generatedAt || new Date().toISOString(),
            generatedBy: raw.generatedBy || 'RepositoryAudit',
            modelInfo: raw.modelInfo || {},
            overview: buildOverview(raw),
            subscriptions: raw.subscriptions || [],
            recentTransactions: raw.recentTransactions || [],
            invoices: raw.invoices || [],
            revenueAnalytics: raw.revenueAnalytics || {},
            metrics: raw.metrics || [],
            alerts: raw.alerts || [],
            quickActions: raw.quickActions || [],
            deprecatedNarrative: raw.deprecatedNarrative || null
        };
    }

    function isStaleBillingSystemModel(model) {
        if (!model) return true;
        const overview = model?.overview || {};
        const subscriptions = model.subscriptions || [];

        if (overview.monthlyRevenue === 234567.45
            || overview.totalRevenue === 1245678.89
            || overview.activeSubscriptions === 1234
            || model.modelInfo?.name === 'unbreakable-oracle'
            || model.modelInfo?.confidence === 96.4
            || (model.generatedBy === 'Cascade AI Platform' && !model.dataSource)) {
            return true;
        }

        if (model.dataSource !== 'repository-audit') {
            return false;
        }

        if (subscriptions.some((plan) =>
            (plan.features || []).some((feature) => String(feature).includes('500 Jest'))
        )) return true;

        return false;
    }

    function formatMetric(value, suffix = '') {
        if (value == null || value === '') return '—';
        return `${value}${suffix}`;
    }

    async function fetchBillingSystemData() {
        try {
            const response = await fetch(SAMPLE_URL);
            if (response.ok) {
                const model = normalizeModel(await response.json());
                if (model?.subscriptions?.length && !isStaleBillingSystemModel(model)) return model;
            }
        } catch (error) {
            console.warn('Billing system sample failed:', error.message);
        }

        try {
            const response = await fetch('/api/billing-system');
            if (response.ok) {
                const payload = await response.json();
                const model = normalizeModel(payload.data || payload);
                if (model?.subscriptions?.length) return model;
            }
        } catch (error) {
            console.warn('Billing system API failed:', error.message);
        }
        return null;
    }

    function formatCurrency(value) {
        if (value == null || value === '') return '—';
        const num = Number(value);
        if (!Number.isFinite(num)) return '—';
        return `$${num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return escapeHtml(value);
        const diff = Date.now() - date.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    function statusBadge(status) {
        const value = String(status || '').toLowerCase();
        if (value === 'completed' || value === 'paid') return 'bg-success';
        if (value === 'pending') return 'bg-warning';
        if (value === 'failed' || value === 'overdue') return 'bg-danger';
        if (value === 'refunded') return 'bg-info';
        return 'bg-secondary';
    }

    function severityClass(severity) {
        const value = String(severity || '').toLowerCase();
        if (value === 'danger' || value === 'critical') return 'danger';
        if (value === 'warning') return 'warning';
        if (value === 'success') return 'success';
        return 'info';
    }

    function planColorClass(color) {
        const map = { primary: 'primary', success: 'success', info: 'info', secondary: 'secondary', warning: 'warning' };
        return map[String(color || '').toLowerCase()] || 'primary';
    }

    function renderModel(model) {
        renderHeader(model);
        renderOverview(model);
        renderSubscriptions(model);
        renderRevenueChart(model);
        renderRevenueByPlan(model);
        renderRevenueSummary(model);
        renderMetrics(model);
        renderQuickActions(model);
        renderTransactions(model);
        renderInvoices(model);
        renderAlerts(model);
    }

    function renderHeader(model) {
        const o = model.overview || {};
        const lead = document.getElementById('billing-system-page-lead');
        if (lead) {
            const base = model.generatedBy
                ? `Generated by ${model.generatedBy} • ${new Date(model.generatedAt || Date.now()).toLocaleString()}`
                : 'Billing and subscription management';
            lead.textContent = model.dataSource === 'repository-audit'
                ? `${base} — internal ops profile, not commercial SaaS billing telemetry.`
                : base;
        }
        const badge = document.getElementById('billing-system-model-badge');
        if (badge) {
            if (model.dataSource === 'repository-audit') {
                badge.textContent = '🛡️ platform-checklist • measured baseline';
            } else {
                badge.textContent = `🧠 ${model.modelInfo?.name || 'GGUF'} • ${model.modelInfo?.confidence || 96}% confidence`;
            }
        }
        const updateEl = document.getElementById('billing-system-last-update');
        if (updateEl) {
            updateEl.textContent = `Updated ${new Date(model.generatedAt || Date.now()).toLocaleTimeString()}`;
        }
        const badges = document.getElementById('bs-header-badges');
        if (badges) {
            if (model.dataSource === 'repository-audit') {
                badges.innerHTML = `
                    <span class="badge bg-secondary me-2">💰 No payment processor</span>
                    <span class="badge bg-primary me-2">👥 Internal dashboard only</span>
                    <span class="badge bg-info me-2">🔌 Stub API + sample JSON</span>
                    <span class="badge bg-warning">🚧 Production billing not scoped</span>
                `;
            } else {
                badges.innerHTML = `
                    <span class="badge bg-success me-2">💰 ${formatCurrency(o.monthlyRevenue)} MRR</span>
                    <span class="badge bg-primary me-2">👥 ${(o.activeSubscriptions ?? 0).toLocaleString()} Subscriptions</span>
                    <span class="badge bg-warning me-2">📉 ${o.churnRate ?? 0}% Churn</span>
                    <span class="badge bg-info">📈 +${o.monthlyGrowth ?? 0}% Growth</span>
                `;
            }
        }
    }

    function renderOverview(model) {
        const o = model.overview || {};
        const map = {
            'bs-stat-total': formatCurrency(o.totalRevenue),
            'bs-stat-monthly': formatCurrency(o.monthlyRevenue),
            'bs-stat-subs': model.dataSource === 'repository-audit'
                ? String(o.activeSubscriptions ?? 0)
                : (o.activeSubscriptions ?? 0).toLocaleString(),
            'bs-stat-churn': formatMetric(o.churnRate, '%')
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderSubscriptions(model) {
        const container = document.getElementById('bs-plans-grid');
        if (!container) return;
        container.innerHTML = (model.subscriptions || []).map((plan) => `
            <div class="bs-plan-card">
                <div class="bs-plan-top">
                    <h4>${escapeHtml(plan.name)}</h4>
                    <span class="badge bg-${planColorClass(plan.color)}">${escapeHtml(plan.growth || '')}</span>
                </div>
                <div class="bs-plan-price">${formatCurrency(plan.price)}<span>/ ${escapeHtml(plan.billingCycle)}</span></div>
                <div class="bs-plan-metrics">
                    <div><strong>${plan.activeCustomers ?? 0}</strong><span>Customers</span></div>
                    <div><strong>${formatCurrency(plan.revenue)}</strong><span>Revenue</span></div>
                </div>
                <ul class="bs-plan-features">
                    ${(plan.features || []).map((f) => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    }

    function renderRevenueChart(model) {
        const canvas = document.getElementById('bsRevenueChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const monthly = model.revenueAnalytics?.monthly || [];
        if (revenueChart) {
            revenueChart.destroy();
            revenueChart = null;
        }

        revenueChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: monthly.map((m) => m.month),
                datasets: [{
                    label: 'Revenue',
                    data: monthly.map((m) => m.revenue),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        ticks: {
                            callback: (v) => `$${(v / 1000).toFixed(0)}k`,
                            color: '#94a3b8'
                        },
                        grid: { color: 'rgba(255,255,255,0.06)' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.04)' }
                    }
                }
            }
        });
    }

    function renderRevenueByPlan(model) {
        const container = document.getElementById('bs-revenue-by-plan');
        if (!container) return;
        container.innerHTML = (model.revenueAnalytics?.byPlan || []).map((item) => `
            <div class="bs-plan-revenue">
                <div class="bs-plan-revenue-header">
                    <span>${escapeHtml(item.plan)}</span>
                    <span class="badge bg-primary">${formatCurrency(item.revenue)}</span>
                </div>
                <div class="da-progress-track"><span style="width:${item.percentage ?? 0}%"></span></div>
                <small>${item.percentage ?? 0}% of total</small>
            </div>
        `).join('');
    }

    function renderRevenueSummary(model) {
        const s = model.revenueAnalytics?.summary || {};
        const o = model.overview || {};
        const map = {
            'bs-rev-growth': s.monthlyGrowth || formatMetric(o.monthlyGrowth, '%') || '—',
            'bs-rev-current': formatCurrency(s.currentMonth ?? o.monthlyRevenue),
            'bs-rev-previous': formatCurrency(s.previousMonth),
            'bs-rev-ytd': formatCurrency(s.ytdRevenue ?? o.ytdRevenue)
        };
        Object.entries(map).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
    }

    function renderMetrics(model) {
        const container = document.getElementById('bs-metrics-grid');
        if (!container) return;
        container.innerHTML = (model.metrics || []).map((metric) => `
            <div class="bs-metric-item">
                <div class="bs-metric-header">
                    <span>${escapeHtml(metric.name)}</span>
                    <span class="bs-metric-value">${escapeHtml(metric.value)}</span>
                </div>
                <div class="da-progress-track ${metric.color === 'success' ? 'good' : metric.color === 'warning' ? 'warning' : ''}">
                    <span style="width:${metric.percentage ?? 0}%"></span>
                </div>
            </div>
        `).join('');
    }

    function renderQuickActions(model) {
        const container = document.getElementById('bs-quick-actions');
        if (!container) return;
        const actions = model.quickActions?.length ? model.quickActions : [
            { label: 'Generate Invoice', icon: '📄', action: 'generate-invoice' },
            { label: 'Process Refund', icon: '↩️', action: 'process-refund' },
            { label: 'Update Subscription', icon: '🔄', action: 'update-subscription' },
            { label: 'Billing Report', icon: '📊', action: 'billing-report' }
        ];
        container.innerHTML = actions.map((action) => `
            <button type="button" class="bs-quick-action" data-action="${escapeHtml(action.action || '')}" data-section="${escapeHtml(action.section || '')}">
                <span>${action.icon || '⚡'}</span>
                <span>${escapeHtml(action.label)}</span>
            </button>
        `).join('');
    }

    function renderTransactions(model) {
        const tbody = document.getElementById('bs-transactions-body');
        if (!tbody) return;
        tbody.innerHTML = (model.recentTransactions || []).map((txn) => `
            <tr>
                <td>
                    <strong>${escapeHtml(txn.customer)}</strong>
                    <div class="bs-subtext">${escapeHtml(txn.email)}</div>
                </td>
                <td><span class="badge bg-primary">${escapeHtml(txn.plan)}</span></td>
                <td><strong>${formatCurrency(txn.amount)}</strong></td>
                <td><span class="badge ${statusBadge(txn.status)}">${escapeHtml(txn.status)}</span></td>
                <td>${escapeHtml(txn.method)}</td>
                <td>${formatDate(txn.date)}</td>
                <td><span class="text-info">${escapeHtml(txn.invoice)}</span></td>
            </tr>
        `).join('');
    }

    function renderInvoices(model) {
        const tbody = document.getElementById('bs-invoices-body');
        if (!tbody) return;
        tbody.innerHTML = (model.invoices || []).map((inv) => `
            <tr>
                <td><span class="text-info">${escapeHtml(inv.number)}</span></td>
                <td>${escapeHtml(inv.customer)}</td>
                <td><strong>${formatCurrency(inv.amount)}</strong></td>
                <td>${formatDate(inv.dueDate)}</td>
                <td><span class="badge ${statusBadge(inv.status)}">${escapeHtml(inv.status)}</span></td>
                <td>${escapeHtml((inv.items || []).join(', '))}</td>
            </tr>
        `).join('');
    }

    function renderAlerts(model) {
        const container = document.getElementById('bs-alerts-list');
        if (!container) return;
        container.innerHTML = (model.alerts || []).map((alert) => `
            <div class="bs-alert-item ${severityClass(alert.severity)}">
                <div class="bs-alert-icon">${alert.icon || '🔔'}</div>
                <div class="bs-alert-body">
                    <div class="bs-alert-header">
                        <strong>${escapeHtml(alert.title)}</strong>
                        <small>${escapeHtml(alert.time)}</small>
                    </div>
                    <p>${escapeHtml(alert.description)}</p>
                    <div class="bs-alert-actions">
                        <button type="button" class="btn btn-sm btn-outline-primary bs-alert-investigate">Investigate</button>
                        <button type="button" class="btn btn-sm btn-outline-secondary bs-alert-dismiss">Dismiss</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function bindActions() {
        const root = document.getElementById('billing-system-root');
        if (!root || root.dataset.actionsBound === 'true') return;
        root.dataset.actionsBound = 'true';

        document.getElementById('bs-load-sample')?.addEventListener('click', () => loadBillingSystemSample());
        document.getElementById('bs-import-json')?.addEventListener('click', () => {
            document.getElementById('bs-import-file')?.click();
        });
        document.getElementById('bs-export-json')?.addEventListener('click', () => {
            const model = window.__billingSystemModel;
            if (!model) {
                window.showNotification?.('❌ No billing data to export', 'error');
                return;
            }
            const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'billing-system-model.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.showNotification?.('✅ Billing data exported', 'success');
        });
        document.getElementById('bs-import-file')?.addEventListener('change', async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
                applyBillingSystemModel(JSON.parse(await file.text()), file.name);
            } catch {
                window.showNotification?.('❌ Invalid JSON file', 'error');
            }
            event.target.value = '';
        });
        document.getElementById('bs-refresh')?.addEventListener('click', async () => {
            try {
                localStorage.removeItem('lastBillingSystemModel');
            } catch { /* ignore */ }
            window.__billingSystemModel = null;
            await loadBillingSystemSample();
        });

        root.addEventListener('click', (event) => {
            const quickBtn = event.target.closest('.bs-quick-action');
            if (quickBtn) {
                event.preventDefault();
                handleBillingQuickAction(quickBtn);
                return;
            }
            if (event.target.closest('.bs-alert-investigate')) {
                window.showNotification?.('🔍 Alert investigation started', 'info');
            }
            if (event.target.closest('.bs-alert-dismiss')) {
                event.target.closest('.bs-alert-item')?.remove();
            }
        });
    }

    function handleBillingQuickAction(quickBtn) {
        const qa = window.QuickActionsCommon;
        const section = quickBtn.dataset.section;
        if (section) {
            qa?.navigateToSection(section);
            return;
        }
        const action = quickBtn.dataset.action;
        if (action === 'export') {
            qa?.clickExportButton('bs-export-json');
            return;
        }
        if (action === 'view-stub-api') {
            qa?.navigateToSection('api');
            return;
        }
        window.showNotification?.(`⚠ Unknown action: ${action || 'unknown'}`, 'warning');
    }

    function applyBillingSystemModel(payload, sourceLabel) {
        const model = normalizeModel(payload);
        if (!model) {
            window.showNotification?.('❌ Not a valid billing-system model', 'error');
            return false;
        }
        if (isStaleBillingSystemModel(model)) {
            window.showNotification?.('❌ Stale billing fiction rejected — load repository-audit sample', 'error');
            return false;
        }
        window.__billingSystemModel = model;
        renderModel(model);
        bindActions();

        if (typeof window.showSection === 'function') {
            const navLink = document.querySelector(".nav-link[onclick*=\"'billing-system'\"]");
            window.showSection('billing-system', navLink);
        }

        try {
            localStorage.setItem('lastBillingSystemModel', JSON.stringify({
                model,
                sourceLabel: sourceLabel || 'Imported billing data',
                savedAt: new Date().toISOString()
            }));
        } catch { /* ignore */ }
        return true;
    }

    function restoreSavedBillingSystemModel() {
        try {
            const raw = localStorage.getItem('lastBillingSystemModel');
            if (!raw) return false;
            const saved = JSON.parse(raw);
            const model = normalizeModel(saved.model || saved);
            if (!model?.subscriptions?.length || isStaleBillingSystemModel(model)) {
                localStorage.removeItem('lastBillingSystemModel');
                return false;
            }
            window.__billingSystemModel = model;
            renderModel(model);
            bindActions();
            return true;
        } catch {
            return false;
        }
    }

    async function loadBillingSystemSample() {
        const root = document.getElementById('billing-system-root');
        root?.classList.add('loading');
        try {
            const response = await fetch(SAMPLE_URL);
            if (!response.ok) throw new Error(`Sample fetch failed (${response.status})`);
            applyBillingSystemModel(await response.json(), 'billing-system-sample.json');
            window.showNotification?.('✅ Loaded billing system sample', 'success');
        } catch (error) {
            console.error('Failed to load billing system sample:', error);
            window.showNotification?.('❌ Failed to load billing system sample', 'error');
        } finally {
            root?.classList.remove('loading');
        }
    }

    async function initializeBillingSystemPage(forceRefresh = false) {
        const root = document.getElementById('billing-system-root');
        if (!root) return;

        if (window.__billingSystemModel && !forceRefresh) {
            if (isStaleBillingSystemModel(window.__billingSystemModel)) {
                try {
                    localStorage.removeItem('lastBillingSystemModel');
                } catch { /* ignore */ }
                window.__billingSystemModel = null;
            } else {
                renderModel(window.__billingSystemModel);
                bindActions();
                return;
            }
        }

        root.classList.add('loading');
        try {
            const model = await fetchBillingSystemData();
            if (model) {
                window.__billingSystemModel = model;
                renderModel(model);
                bindActions();
                return;
            }
            if (!forceRefresh && restoreSavedBillingSystemModel()) {
                return;
            }
            throw new Error('No billing system data available');
        } catch (error) {
            console.error('Failed to initialize billing system page:', error);
            window.showNotification?.('❌ Failed to load billing data', 'error');
        } finally {
            root.classList.remove('loading');
        }
    }

    window.applyBillingSystemModel = applyBillingSystemModel;
    window.loadBillingSystemSample = loadBillingSystemSample;
    window.initializeBillingSystemPage = initializeBillingSystemPage;
})();
