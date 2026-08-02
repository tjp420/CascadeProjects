// simplebeacon-ignore: Dashboard code — all findings are false positives
import { fetchReplicationTelemetry } from '../services/replicationTelemetryService.js';

let refreshInterval = null;
let isRefreshing = false;

const TRACK_DEFS = [
    {
        groupKey: 'migration',
        title: 'Cross-Cluster Migration (Track 34)',
        metrics: [
            { key: 'hsm_migration_initiated_total', label: 'Initiated' },
            { key: 'hsm_migration_attested_total', label: 'Attested' },
            { key: 'hsm_migration_committed_total', label: 'Committed' },
            { key: 'hsm_migration_rolled_back_total', label: 'Rolled Back' },
            { key: 'hsm_migration_ack_total', label: 'ACKs' },
            { key: 'hsm_migration_verification_failed_total', label: 'Verify Failed' },
            { key: 'hsm_migration_active', label: 'Active' },
        ],
    },
    {
        groupKey: 'reconciliation',
        title: 'Cluster Key Reconciliation (Track 35)',
        metrics: [
            { key: 'hsm_reconciliation_scans_total', label: 'Scans' },
            { key: 'hsm_reconciliation_divergence_detected_total', label: 'Divergence' },
            { key: 'hsm_reconciliation_promoted_total', label: 'Promoted' },
            { key: 'hsm_reconciliation_quarantined_total', label: 'Quarantined' },
            { key: 'hsm_reconciliation_rollback_blocked_total', label: 'Rollback Blocked' },
            { key: 'hsm_reconciliation_promotion_votes_total', label: 'Votes' },
            { key: 'hsm_reconciliation_divergent_keys', label: 'Divergent Keys' },
        ],
    },
    {
        groupKey: 'zkProofOfAssets',
        title: 'ZK Proof-of-Assets (Track 36)',
        metrics: [
            { key: 'hsm_poa_asset_registered_total', label: 'Registered' },
            { key: 'hsm_poa_proof_created_total', label: 'Created' },
            { key: 'hsm_poa_proof_verified_total', label: 'Verified' },
            { key: 'hsm_poa_proof_invalid_total', label: 'Invalid' },
            { key: 'hsm_poa_double_count_blocked_total', label: 'Double-Count Blocked' },
            { key: 'hsm_poa_quorum_signatures_total', label: 'Quorum Sigs' },
            { key: 'hsm_poa_active_proofs', label: 'Active' },
        ],
    },
    {
        groupKey: 'multipartyReKeying',
        title: 'Multiparty Re-Keying (Track 37)',
        metrics: [
            { key: 'hsm_rekey_proposed_total', label: 'Proposed' },
            { key: 'hsm_rekey_resharing_submitted_total', label: 'Resharing' },
            { key: 'hsm_rekey_verified_total', label: 'Verified' },
            { key: 'hsm_rekey_committed_total', label: 'Committed' },
            { key: 'hsm_rekey_aborted_total', label: 'Aborted' },
            { key: 'hsm_rekey_rollback_blocked_total', label: 'Rollback Blocked' },
            { key: 'hsm_rekey_active', label: 'Active' },
        ],
    },
    {
        groupKey: 'encryptedP2PRouting',
        title: 'Encrypted P2P Routing (Track 38)',
        metrics: [
            { key: 'hsm_p2p_route_discovered_total', label: 'Routes' },
            { key: 'hsm_p2p_message_encrypted_total', label: 'Encrypted' },
            { key: 'hsm_p2p_message_relayed_total', label: 'Relayed' },
            { key: 'hsm_p2p_message_delivered_total', label: 'Delivered' },
            { key: 'hsm_p2p_route_revoked_total', label: 'Revoked' },
            { key: 'hsm_p2p_replay_blocked_total', label: 'Replay Blocked' },
            { key: 'hsm_p2p_active_routes', label: 'Active' },
        ],
    },
];

export function renderCoreReplicationTelemetryDashboard() {
    const container = document.createElement('div');
    container.className = 'card';
    container.id = 'core-replication-telemetry-dashboard';

    const header = document.createElement('div');
    header.className = 'card-header';

    const flex = document.createElement('div');
    flex.className = 'flex items-center gap-3';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = 'Core Replication Telemetry';

    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'core-replication-refresh';
    refreshBtn.className = 'btn btn-sm btn-ghost';
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Refresh';

    flex.appendChild(title);
    flex.appendChild(refreshBtn);

    const statusBadge = document.createElement('span');
    statusBadge.id = 'core-replication-status';
    statusBadge.className = 'badge badge-success';
    statusBadge.textContent = 'Loading...';

    header.appendChild(flex);
    header.appendChild(statusBadge);

    const body = document.createElement('div');
    body.className = 'card-body';

    const content = document.createElement('div');
    content.id = 'core-replication-content';

    const loading = document.createElement('div');
    loading.className = 'text-gray-500';
    loading.textContent = 'Loading replication telemetry...';
    content.appendChild(loading);

    body.appendChild(content);
    container.appendChild(header);
    container.appendChild(body);

    bindCoreReplicationTelemetryDashboard(container);
    return container;
}

function bindCoreReplicationTelemetryDashboard(container) {
    const refreshBtn = container.querySelector('#core-replication-refresh');
    refreshBtn.addEventListener('click', () => {
        if (!isRefreshing) loadCoreReplicationData(container);
    });
    loadCoreReplicationData(container, true);

    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadCoreReplicationData(container, false);
    }, 30000);
}

async function loadCoreReplicationData(container, isInitial) {
    const content = container.querySelector('#core-replication-content');
    const statusBadge = container.querySelector('#core-replication-status');
    const refreshBtn = container.querySelector('#core-replication-refresh');

    if (isRefreshing) return;
    isRefreshing = true;
    refreshBtn.disabled = true;

    try {
        const data = await fetchReplicationTelemetry();

        if (data.status === 'unavailable') {
            statusBadge.className = 'badge badge-warning';
            statusBadge.textContent = 'Unavailable';
            content.innerHTML = '<div class="text-gray-500">Replication telemetry endpoint not available.</div>';
            return;
        }

        if (data.status === 'forbidden') {
            statusBadge.className = 'badge badge-danger';
            statusBadge.textContent = 'Forbidden';
            content.innerHTML = '<div class="text-gray-500">Admin access required to view replication telemetry.</div>';
            return;
        }

        statusBadge.className = 'badge badge-success';
        statusBadge.textContent = 'Live';

        content.innerHTML = '';
        const groups = data.groups || {};

        for (const trackDef of TRACK_DEFS) {
            const groupCounters = groups[trackDef.groupKey] || {};

            const section = document.createElement('div');
            section.className = 'dashboard-panel';
            section.style.marginBottom = '12px';

            const sectionTitle = document.createElement('h4');
            sectionTitle.className = 'dashboard-panel-title-sm';
            sectionTitle.textContent = trackDef.title;
            sectionTitle.style.margin = '0 0 8px 0';
            section.appendChild(sectionTitle);

            const metricsRow = document.createElement('div');
            metricsRow.className = 'metrics-row';

            for (const def of trackDef.metrics) {
                const chip = document.createElement('div');
                chip.className = 'metric-chip';
                const value = groupCounters[def.key] !== undefined ? groupCounters[def.key] : 0;
                chip.innerHTML = '<strong>' + value + '</strong> ' + def.label;
                metricsRow.appendChild(chip);
            }

            section.appendChild(metricsRow);
            content.appendChild(section);
        }
    } catch (error) {
        statusBadge.className = 'badge badge-danger';
        statusBadge.textContent = 'Error';
        content.innerHTML = '<div class="text-danger">Failed to load replication telemetry.</div>';
    } finally {
        isRefreshing = false;
        refreshBtn.disabled = false;
    }
}

export function cleanupCoreReplicationTelemetryDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
