/**
 * Resolve dashboard API payloads from PostgreSQL snapshots with JSON fallback.
 */

const { REAL_API_PATH_PREFIXES } = require('./snapshot-seeds.cjs');
const { readDashboardSnapshot } = require('../bootstrap/phase2-integration.cjs');
const {
    getCachedSnapshot,
    setCachedSnapshot
} = require('./redis-cache.cjs');

function tagSnapshotPayloadWithSource(snapshotPayload, snapshotSource) {
    if (snapshotPayload == null) return snapshotPayload;
    if (Array.isArray(snapshotPayload)) {
        return snapshotPayload;
    }
    if (typeof snapshotPayload === 'object') {
        return { ...snapshotPayload, _source: snapshotSource };
    }
    return snapshotPayload;
}

async function resolveSnapshotPayload(db, key, fallbackFn, redis = null) {
    if (redis) {
        const cached = await getCachedSnapshot(redis, key);
        if (cached !== null && cached !== undefined) {
            return tagSnapshotPayloadWithSource(cached, 'redis');
        }
    }

    if (db) {
        const snapshot = await readDashboardSnapshot(db, key);
        if (snapshot !== null && snapshot !== undefined) {
            if (redis) {
                await setCachedSnapshot(redis, key, snapshot);
            }
            return tagSnapshotPayloadWithSource(snapshot, 'database');
        }
    }

    const fallback = await fallbackFn();
    return tagSnapshotPayloadWithSource(fallback, 'sample');
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
    tagSnapshotPayloadWithSource
};
