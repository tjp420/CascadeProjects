// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Enclave Telemetry Service
 * Fetches hardware enclave state and counters (Track 41) from the vault API.
 */

export async function fetchEnclaveTelemetry() {
    try {
        const response = await fetch('/api/vault/enclave/status');
        if (!response.ok) {
            if (response.status === 403) return { status: 'forbidden', registered: false, counters: {} };
            if (response.status === 404 || response.status === 503) return { status: 'unavailable', registered: false, counters: {} };
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        const data = await response.json();
        if (data.success !== true) {
            throw new Error(data.error || 'Failed to retrieve enclave telemetry');
        }
        return {
            status: 'success',
            registered: Boolean(data.registered),
            backend: data.backend || null,
            mrenclave: data.mrenclave || null,
            initialized: Boolean(data.initialized),
            counters: data.counters || {},
            timestamp: data.timestamp,
        };
    }
    catch (error) {
        const msg = (error === null || error === void 0 ? void 0 : error.message) || String(error);
        if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
            return { status: 'unavailable', registered: false, counters: {} };
        }
        window["console"]["error"]('[enclaveTelemetryService] Error fetching telemetry:', msg);
        throw error;
    }
}

export async function getEnclaveStatus() {
    const data = await fetchEnclaveTelemetry();
    return {
        registered: data.registered,
        backend: data.backend,
        mrenclave: data.mrenclave,
        initialized: data.initialized,
    };
}
