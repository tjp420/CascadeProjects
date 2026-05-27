/**
 * Resolve dashboard API payloads from PostgreSQL snapshots with JSON fallback.
 */

const { REAL_API_PATH_PREFIXES } = require('./snapshot-seeds');
const { readDashboardSnapshot } = require('../bootstrap/phase2-integration');
const {
    getCachedSnapshot,
    setCachedSnapshot
} = require('./redis-cache');

function withSource(payload, source) {
    if (payload == null) return payload;
    if (Array.isArray(payload)) {
        return payload;
    }
    if (typeof payload === 'object') {
        return { ...payload, _source: source };
    }
    return payload;
}

async function resolveSnapshotPayload(db, key, fallbackFn, redis = null) {
    if (redis) {
        const cached = await getCachedSnapshot(redis, key);
        if (cached !== null && cached !== undefined) {
            return withSource(cached, 'redis');
        }
    }

    if (db) {
        const snapshot = await readDashboardSnapshot(db, key);
        if (snapshot !== null && snapshot !== undefined) {
            if (redis) {
                await setCachedSnapshot(redis, key, snapshot);
            }
            return withSource(snapshot, 'database');
        }
    }

    const fallback = await fallbackFn();
    return withSource(fallback, 'sample');
}

async function sendSnapshotOrSample(res, db, key, fallbackFn, redis = null) {
    const payload = await resolveSnapshotPayload(db, key, fallbackFn, redis);
    res.json(payload);
}

/** API path prefixes that should bypass client-side mock-backend.js when USE_REAL_API is auto. */
// Re-exported from snapshot-seeds.js — single source of truth

function isRealApiPath(url) {
    const path = String(url).split('?')[0];
    return REAL_API_PATH_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
    );
}

module.exports = {
    resolveSnapshotPayload,
    sendSnapshotOrSample,
    REAL_API_PATH_PREFIXES,
    isRealApiPath,
    withSource
};
