// simplebeacon-ignore: Dashboard code — all findings are false positives
import { fetchEnclaveTelemetry, getEnclaveHistory } from '../services/enclaveTelemetryService.js';
import { renderSparkline } from '../utils/sparkline.js';

let refreshInterval = null;
let isRefreshing = false;

const COUNTER_DEFS = [
    { key: 'hsm_enclave_bootstrap_total', label: 'Bootstrap OK', severity: 'positive' },
    { key: 'hsm_enclave_bootstrap_failed_total', label: 'Bootstrap Fail', severity: 'danger' },
    { key: 'hsm_enclave_seal_total', label: 'Sealed', severity: 'positive' },
    { key: 'hsm_enclave_unseal_total', label: 'Unsealed', severity: 'positive' },
    { key: 'hsm_enclave_unseal_failed_total', label: 'Unseal Fail', severity: 'danger' },
    { key: 'hsm_enclave_key_provisioned_total', label: 'Keys Provisioned', severity: 'positive' },
    { key: 'hsm_enclave_key_provision_blocked_total', label: 'Provision Blocked', severity: 'warning' },
    { key: 'hsm_enclave_attestation_verified_total', label: 'Attestation OK', severity: 'positive' },
    { key: 'hsm_enclave_attestation_rejected_total', label: 'Attestation Rejected', severity: 'danger' },
    { key: 'hsm_enclave_active', label: 'Active Enclaves', severity: 'active' },
];

function getSeverityClass(def, value) {
    if (def.severity === 'danger') return value > 0 ? 'metric-chip-danger' : 'metric-chip-ok';
    if (def.severity === 'warning') return value > 0 ? 'metric-chip-warning' : 'metric-chip-ok';
    if (def.severity === 'positive') return value > 0 ? 'metric-chip-ok' : 'metric-chip-neutral';
    if (def.severity === 'active') return value > 0 ? 'metric-chip-ok' : 'metric-chip-warning';
    return 'metric-chip-neutral';
}

export function renderEnclaveTelemetryDashboard() {
    const container = document.createElement('div');
    container.className = 'card';
    container.id = 'enclave-telemetry-dashboard';

    const header = document.createElement('div');
    header.className = 'card-header';

    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-3';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Hardware Enclave Telemetry';

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'enclave-telemetry-refresh';
    refreshBtn.className = 'btn btn-sm btn-ghost';
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refresh';

    flex.appendChild(title);
    flex.appendChild(refreshBtn);

    const statusBadge = document.createElement('span');
    statusBadge.id = 'enclave-telemetry-status';
    statusBadge.className = 'badge badge-success';
    statusBadge.textContent = 'Loading...';

    header.appendChild(flex);
    header.appendChild(statusBadge);

    const body = document.createElement('div');
    body.className = 'card-body';

    const stateBanner = document.createElement('div');
    stateBanner.id = 'enclave-state-banner';
    stateBanner.className = 'enclave-state-banner';

    const content = document.createElement('div');
    content.id = 'enclave-telemetry-content';

    const loading = document.createElement('div');
    loading.className = 'text-gray-500';
    loading.textContent = 'Loading enclave telemetry...';
    content.appendChild(loading);

    body.appendChild(stateBanner);
    body.appendChild(content);
    container.appendChild(header);
    container.appendChild(body);

    bindEnclaveTelemetryDashboard(container);
    return container;
}

function bindEnclaveTelemetryDashboard(container) {
    const refreshBtn = container.querySelector('#enclave-telemetry-refresh');
    refreshBtn.addEventListener('click', () => {
        if (!isRefreshing) loadEnclaveTelemetryData(container);
    });
    loadEnclaveTelemetryData(container, true);

    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadEnclaveTelemetryData(container, false);
    }, 15000);
}

async function loadEnclaveTelemetryData(container, isInitial) {
    const content = container.querySelector('#enclave-telemetry-content');
    const stateBanner = container.querySelector('#enclave-state-banner');
    const statusBadge = container.querySelector('#enclave-telemetry-status');
    const refreshBtn = container.querySelector('#enclave-telemetry-refresh');

    if (isRefreshing) return;
    isRefreshing = true;
    refreshBtn.disabled = true;

    try {
        const data = await fetchEnclaveTelemetry();

        if (data.status === 'unavailable') {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'Unavailable';
            stateBanner.innerHTML = '';
            content.innerHTML = '<div class="text-gray-500">Enclave telemetry endpoint not available.</div>';
            return;
        }

        if (data.status === 'forbidden') {
            statusBadge.className = 'badge badge-danger';
            statusBadge.textContent = 'Forbidden';
            stateBanner.innerHTML = '';
            content.innerHTML = '<div class="text-gray-500">Admin access required to view enclave telemetry.</div>';
            return;
        }

        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = data.registered ? (data.initialized ? 'Initialized' : 'Registered') : 'Not Registered';

        // Render state banner
        const backend = data.backend || '—';
        const mrenclave = data.mrenclave ? data.mrenclave.substring(0, 24) + '...' : '—';
        const initStatus = data.initialized ? '● Initialized' : '○ Not Initialized';
        const initClass = data.initialized ? 'enclave-init-ok' : 'enclave-init-pending';
        stateBanner.innerHTML = '<div class="enclave-state-row">' +
            '<span class="enclave-state-item"><strong>Backend:</strong> ' + backend + '</span>' +
            '<span class="enclave-state-item"><strong>MRENCLAVE:</strong> ' + mrenclave + '</span>' +
            '<span class="enclave-state-item ' + initClass + '">' + initStatus + '</span>' +
            '</div>';

        // Render counter chips
        const counters = data.counters || {};
        content.innerHTML = '';
        const metricsRow = document.createElement('div');
        metricsRow.className = 'metrics-row';

        for (const def of COUNTER_DEFS) {
            const value = counters[def.key] !== undefined ? counters[def.key] : 0;
            const chip = document.createElement('div');
            chip.className = 'metric-chip ' + getSeverityClass(def, value);
            const history = getEnclaveHistory(def.key);
            const sparkline = renderSparkline(history);
            if (sparkline) chip.appendChild(sparkline);
            const labelSpan = document.createElement('span');
            labelSpan.innerHTML = '<strong>' + value + '</strong> ' + def.label;
            chip.appendChild(labelSpan);
            metricsRow.appendChild(chip);
        }

        content.appendChild(metricsRow);
    } catch (error) {
        statusBadge.className = 'badge badge-danger';
        statusBadge.textContent = 'Error';
        stateBanner.innerHTML = '';
        content.innerHTML = '<div class="text-danger">Failed to load enclave telemetry.</div>';
    } finally {
        isRefreshing = false;
        refreshBtn.disabled = false;
    }
}

export function cleanupEnclaveTelemetryDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
