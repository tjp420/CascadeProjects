const {
    snapshotCacheKey,
    getCachedSnapshot,
    setCachedSnapshot,
    invalidateSnapshotCache
} = require('../../server/lib/redis-cache');

describe('redis cache helpers', () => {
    test('snapshotCacheKey prefixes dashboard snapshot keys', () => {
        expect(snapshotCacheKey('settings-overview', 'cascade:')).toBe(
            'cascade:dashboard:snapshot:settings-overview'
        );
    });

    test('getCachedSnapshot parses stored JSON', async () => {
        const redis = {
            get: jest.fn().mockResolvedValue(JSON.stringify({ ok: true }))
        };
        const payload = await getCachedSnapshot(redis, 'demo-key', {
            keyPrefix: 'cascade:',
            defaultTtlSeconds: 60
        });
        expect(payload).toEqual({ ok: true });
        expect(redis.get).toHaveBeenCalledWith('cascade:dashboard:snapshot:demo-key');
    });

    test('setCachedSnapshot stores JSON with TTL', async () => {
        const redis = { set: jest.fn().mockResolvedValue('OK') };
        await setCachedSnapshot(redis, 'demo-key', { value: 1 }, {
            keyPrefix: 'cascade:',
            defaultTtlSeconds: 90
        });
        expect(redis.set).toHaveBeenCalledWith(
            'cascade:dashboard:snapshot:demo-key',
            JSON.stringify({ value: 1 }),
            { EX: 90 }
        );
    });

    test('invalidateSnapshotCache deletes the cache entry', async () => {
        const redis = { del: jest.fn().mockResolvedValue(1) };
        await invalidateSnapshotCache(redis, 'demo-key', { keyPrefix: 'cascade:' });
        expect(redis.del).toHaveBeenCalledWith('cascade:dashboard:snapshot:demo-key');
    });
});
