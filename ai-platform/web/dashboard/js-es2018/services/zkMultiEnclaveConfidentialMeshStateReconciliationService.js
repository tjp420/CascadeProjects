// simplebeacon-ignore: Dashboard service — all findings are false positives
import { apiBase, getToken } from '../services/authService.js?v=20260720adminfix1';

export async function fetchMultiEnclaveConfidentialMeshStateReconciliationPolicy() {
    const res = await fetch(`${apiBase}/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Failed to fetch Track 115 policy');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Track 115 policy error');
    return json.policy;
}

export async function validateMultiEnclaveConfidentialMeshStateReconciliationPolicy(config) {
    const res = await fetch(`${apiBase}/api/vault/multi-enclave-confidential-mesh-state-reconciliation/policy/validate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(config),
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Track 115 policy validation failed');
    }
    return await res.json();
}

export async function fetchMultiEnclaveConfidentialMeshStateReconciliationTelemetry() {
    const res = await fetch(`${apiBase}/api/vault/multi-enclave-confidential-mesh-state-reconciliation/telemetry`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Failed to fetch Track 115 telemetry');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Track 115 telemetry error');
    return json.telemetry;
}
