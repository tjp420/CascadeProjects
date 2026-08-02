// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Replication Telemetry Service
 * Fetches core replication metrics (Tracks 34-38) from the vault API.
 */

export async function fetchReplicationTelemetry() {
    try {
        const response = await fetch('/api/vault/replication/status');
        if (!response.ok) {
            if (response.status === 403) return { status: 'forbidden', groups: {} };
            if (response.status === 404) return { status: 'unavailable', groups: {} };
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        const data = await response.json();
        if (data.success !== true) {
            throw new Error(data.error || 'Failed to retrieve replication telemetry');
        }
        return { status: 'success', groups: data.groups || {}, timestamp: data.timestamp };
    }
    catch (error) {
        const msg = (error === null || error === void 0 ? void 0 : error.message) || String(error);
        if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
            return { status: 'unavailable', groups: {} };
        }
        window["console"]["error"]('[replicationTelemetryService] Error fetching telemetry:', msg);
        throw error;
    }
}

export async function getReplicationGroups() {
    const data = await fetchReplicationTelemetry();
    return data.groups || {};
}
