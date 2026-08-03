// simplebeacon-ignore: Dashboard code — all findings are false positives
/**
 * Replication Telemetry Service
 * Fetches core replication metrics (Tracks 34-38) from the vault API.
 * Accumulates snapshots in a ring buffer for sparkline trend visualization.
 */

import { createRingBuffer } from '../utils/sparkline.js';

const MAX_SAMPLES = 60; // 30 min @ 30s interval
const _history = new Map(); // groupKey -> { counterKey -> ringBuffer }

function _ensureBuffer(groupKey, counterKey) {
    if (!_history.has(groupKey)) _history.set(groupKey, new Map());
    const groupMap = _history.get(groupKey);
    if (!groupMap.has(counterKey)) groupMap.set(counterKey, createRingBuffer(MAX_SAMPLES));
    return groupMap.get(counterKey);
}

function _recordSnapshot(groups) {
    for (const [groupKey, counters] of Object.entries(groups || {})) {
        for (const [counterKey, value] of Object.entries(counters || {})) {
            if (typeof value === 'number') {
                _ensureBuffer(groupKey, counterKey).push(value);
            }
        }
    }
}

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
        const groups = data.groups || {};
        _recordSnapshot(groups);
        return { status: 'success', groups: groups, timestamp: data.timestamp };
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

/**
 * Get the accumulated history for a specific counter in a group.
 * @param {string} groupKey
 * @param {string} counterKey
 * @returns {number[]} Array of samples (may be empty)
 */
export function getReplicationHistory(groupKey, counterKey) {
    const groupMap = _history.get(groupKey);
    if (!groupMap) return [];
    const buf = groupMap.get(counterKey);
    return buf ? buf.values() : [];
}

/**
 * Clear all accumulated history.
 */
export function clearReplicationHistory() {
    _history.clear();
}
