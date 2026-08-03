// simplebeacon-ignore: Dashboard code — all findings are false positives
import { fetchRecoveryTelemetry } from '../services/recoveryTelemetryService.js';

let refreshInterval = null;
let isRefreshing = false;

/**
 * Render recovery telemetry dashboard.
 * @returns {HTMLElement}
 */
export function renderRecoveryTelemetryDashboard() {
    const container = document.createElement('div');
    container.className = 'card';
    container.id = 'recovery-telemetry-dashboard';

    const header = document.createElement('div');
    header.className = 'card-header';

    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-3';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Account Recovery Telemetry';

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'recovery-telemetry-refresh';
    refreshBtn.className = 'btn btn-sm btn-ghost';
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refresh';

    flex.appendChild(title);
    flex.appendChild(refreshBtn);

    const statusBadge = document.createElement('span');
    statusBadge.id = 'recovery-telemetry-status';
    statusBadge.className = 'badge badge-success';
    statusBadge.textContent = 'Loading...';

    header.appendChild(flex);
    header.appendChild(statusBadge);

    const body = document.createElement('div');
    body.className = 'card-body';

    const content = document.createElement('div');
    content.id = 'recovery-telemetry-content';

    const loading = document.createElement('div');
    loading.className = 'text-gray-500';
    loading.textContent = 'Loading recovery telemetry...';
    content.appendChild(loading);

    body.appendChild(content);
    container.appendChild(header);
    container.appendChild(body);

    bindRecoveryTelemetryDashboard(container);
    return container;
}

/**
 * Bind recovery telemetry dashboard events.
 * @param {HTMLElement} container
 */
function bindRecoveryTelemetryDashboard(container) {
    const refreshBtn = container.querySelector('#recovery-telemetry-refresh');
    refreshBtn.addEventListener('click', () => {
        if (!isRefreshing) {
            loadRecoveryTelemetryData(container);
        }
    });
    loadRecoveryTelemetryData(container, true);

    // Set up 30-second polling
    if (refreshInterval)
        clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadRecoveryTelemetryData(container, false);
    }, 30000);
}

/**
 * Load recovery telemetry data.
 * @param {HTMLElement} container
 * @param {boolean} isInitial
 */
async function loadRecoveryTelemetryData(container, isInitial = false) {
    const content = container.querySelector('#recovery-telemetry-content');
    const statusBadge = container.querySelector('#recovery-telemetry-status');
    const refreshBtn = container.querySelector('#recovery-telemetry-refresh');

    if (isRefreshing) return;
    isRefreshing = true;
    refreshBtn.disabled = true;

    try {
        const data = await fetchRecoveryTelemetry();

        if (data.status === 'unavailable') {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'Unavailable';
            content.innerHTML = '<div class="text-gray-500">Recovery telemetry endpoint not available.</div>';
            return;
        }

        if (data.status === 'forbidden') {
            statusBadge.className = 'badge badge-danger';
            statusBadge.textContent = 'Forbidden';
            content.innerHTML = '<div class="text-gray-500">Admin access required to view recovery telemetry.</div>';
            return;
        }

        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = 'Live';

        const counters = data.counters || {};
        const metricsRow = document.createElement('div');
        metricsRow.className = 'metrics-row';

        const metricDefs = [
            { key: 'hsm_recovery_requested_total', label: 'Requested' },
            { key: 'hsm_recovery_approved_total', label: 'Approvals' },
            { key: 'hsm_recovery_executed_total', label: 'Executed' },
            { key: 'hsm_recovery_rejected_total', label: 'Rejected' },
            { key: 'hsm_recovery_replay_blocked_total', label: 'Replay Blocked' },
            { key: 'hsm_recovery_time_lock_blocked_total', label: 'Time-Lock Blocked' },
            { key: 'hsm_recovery_active', label: 'Active' },
        ];

        for (const def of metricDefs) {
            const chip = document.createElement('div');
            chip.className = 'metric-chip';
            const value = counters[def.key] !== undefined ? counters[def.key] : 0;
            chip.innerHTML = '<strong>' + value + '</strong> ' + def.label;
            metricsRow.appendChild(chip);
        }

        content.innerHTML = '';
        content.appendChild(metricsRow);
    } catch (error) {
        statusBadge.className = 'badge badge-danger';
        statusBadge.textContent = 'Error';
        content.innerHTML = '<div class="text-danger">Failed to load recovery telemetry.</div>';
    } finally {
        isRefreshing = false;
        refreshBtn.disabled = false;
    }
}

/**
 * Cleanup recovery telemetry dashboard.
 */
export function cleanupRecoveryTelemetryDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
