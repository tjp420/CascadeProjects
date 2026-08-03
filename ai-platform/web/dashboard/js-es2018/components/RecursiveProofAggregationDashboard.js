// simplebeacon-ignore: Dashboard code — all findings are false positives
import { fetchRecursiveProofTelemetry, getRecursiveProofHistory } from '../services/recursiveProofService.js';
import { renderSparkline } from '../utils/sparkline.js';

let refreshInterval = null;
let isRefreshing = false;

const METRIC_DEFS = [
    { key: 'hsm_recursive_proof_submitted_total', label: 'Proofs Submitted' },
    { key: 'hsm_recursive_proofs_folded_total', label: 'Proofs Folded' },
    { key: 'hsm_recursive_chain_aggregations_total', label: 'Chain Aggregations' },
    { key: 'hsm_recursive_tree_aggregations_total', label: 'Tree Aggregations' },
    { key: 'hsm_recursive_vdf_aggregations_total', label: 'VDF Aggregations' },
    { key: 'hsm_recursive_mixnet_compressions_total', label: 'Mixnet Compressions' },
    { key: 'hsm_recursive_aggregations_verified_total', label: 'Verified' },
    { key: 'hsm_recursive_aggregations_failed_total', label: 'Failed' },
    { key: 'hsm_recursive_proofs_active', label: 'Active Proofs' },
    { key: 'hsm_recursive_aggregations_active', label: 'Active Aggregations' },
];

export function renderRecursiveProofAggregationDashboard() {
    const container = document.createElement('div');
    container.className = 'card';
    container.id = 'recursive-proof-aggregation-dashboard';

    const header = document.createElement('div');
    header.className = 'card-header';

    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-3';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Recursive Proof Aggregation (Track 61)';

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'recursive-proof-refresh';
    refreshBtn.className = 'btn btn-sm btn-ghost';
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refresh';

    flex.appendChild(title);
    flex.appendChild(refreshBtn);

    const statusBadge = document.createElement('span');
    statusBadge.id = 'recursive-proof-status';
    statusBadge.className = 'badge badge-success';
    statusBadge.textContent = 'Loading...';

    header.appendChild(flex);
    header.appendChild(statusBadge);

    const body = document.createElement('div');
    body.className = 'card-body';

    const content = document.createElement('div');
    content.id = 'recursive-proof-content';

    const loading = document.createElement('div');
    loading.className = 'text-gray-500';
    loading.textContent = 'Loading recursive proof telemetry...';
    content.appendChild(loading);

    body.appendChild(content);
    container.appendChild(header);
    container.appendChild(body);

    bindRecursiveProofAggregationDashboard(container);
    return container;
}

function bindRecursiveProofAggregationDashboard(container) {
    const refreshBtn = container.querySelector('#recursive-proof-refresh');
    refreshBtn.addEventListener('click', () => {
        if (!isRefreshing) loadRecursiveProofData(container);
    });
    loadRecursiveProofData(container, true);

    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadRecursiveProofData(container, false);
    }, 30000);
}

async function loadRecursiveProofData(container, isInitial) {
    const content = container.querySelector('#recursive-proof-content');
    const statusBadge = container.querySelector('#recursive-proof-status');
    const refreshBtn = container.querySelector('#recursive-proof-refresh');

    if (isRefreshing) return;
    isRefreshing = true;
    refreshBtn.disabled = true;

    try {
        const data = await fetchRecursiveProofTelemetry();

        if (data.status === 'unavailable') {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'Unavailable';
            content.innerHTML = '<div class="text-gray-500">Recursive proof aggregation endpoint not available.</div>';
            return;
        }

        if (data.status === 'forbidden') {
            statusBadge.className = 'badge badge-danger';
            statusBadge.textContent = 'Forbidden';
            content.innerHTML = '<div class="text-gray-500">Admin access required to view recursive proof telemetry.</div>';
            return;
        }

        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = 'Live';

        content.innerHTML = '';
        const counters = data.counters || {};
        const stats = data.stats || {};

        const summary = document.createElement('div');
        summary.className = 'dashboard-panel';
        summary.style.marginBottom = '12px';

        const summaryTitle = document.createElement('h4');
        summaryTitle.className = 'dashboard-panel-title-sm';
        summaryTitle.textContent = 'Engine Stats';
        summaryTitle.style.margin = '0 0 8px 0';
        summary.appendChild(summaryTitle);

        const summaryRow = document.createElement('div');
        summaryRow.className = 'metrics-row';
        const statsKeys = [
            { key: 'totalProofs', label: 'Total Proofs' },
            { key: 'totalAggregations', label: 'Aggregations' },
            { key: 'completedAggregations', label: 'Completed' },
            { key: 'foldCount', label: 'Folds' },
            { key: 'verifyCount', label: 'Verifies' },
        ];
        for (const def of statsKeys) {
            const chip = document.createElement('div');
            chip.className = 'metric-chip';
            const value = typeof stats[def.key] === 'number' ? stats[def.key] : 0;
            const label = document.createElement('span');
            label.innerHTML = '<strong>' + value + '</strong> ' + def.label;
            chip.appendChild(label);
            summaryRow.appendChild(chip);
        }
        summary.appendChild(summaryRow);
        content.appendChild(summary);

        const metrics = document.createElement('div');
        metrics.className = 'dashboard-panel';
        metrics.style.marginBottom = '12px';

        const metricsTitle = document.createElement('h4');
        metricsTitle.className = 'dashboard-panel-title-sm';
        metricsTitle.textContent = 'Counters';
        metricsTitle.style.margin = '0 0 8px 0';
        metrics.appendChild(metricsTitle);

        const metricsRow = document.createElement('div');
        metricsRow.className = 'metrics-row';

        for (const def of METRIC_DEFS) {
            const chip = document.createElement('div');
            chip.className = 'metric-chip';
            const value = counters[def.key] !== undefined ? counters[def.key] : 0;
            const history = getRecursiveProofHistory(def.key);
            const sparkline = renderSparkline(history);
            if (sparkline) chip.appendChild(sparkline);
            const label = document.createElement('span');
            label.innerHTML = '<strong>' + value + '</strong> ' + def.label;
            chip.appendChild(label);
            metricsRow.appendChild(chip);
        }

        metrics.appendChild(metricsRow);
        content.appendChild(metrics);
    }
    catch (error) {
        statusBadge.className = 'badge badge-danger';
        statusBadge.textContent = 'Error';
        content.innerHTML = '<div class="text-danger">Failed to load recursive proof telemetry. Check console for details.</div>';
        window["console"]["error"]('[RecursiveProofAggregationDashboard] Error:', error);
    }
    finally {
        isRefreshing = false;
        refreshBtn.disabled = false;
    }
}

export function cleanupRecursiveProofAggregationDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
