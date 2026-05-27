jest.mock('../../server/bootstrap/phase2-integration', () => ({
    readDashboardSnapshot: jest.fn()
}));

const phase2Integration = require('../../server/bootstrap/phase2-integration');
const {
    isRealApiPath,
    withSource,
    resolveSnapshotPayload,
    sendSnapshotOrSample
} = require('../../server/lib/snapshot-resolver');

describe('snapshot resolver', () => {
    beforeEach(() => {
        phase2Integration.readDashboardSnapshot.mockReset();
    });

    test('isRealApiPath matches Phase 2 server routes', () => {
        expect(isRealApiPath('/api/settings/overview')).toBe(true);
        expect(isRealApiPath('/api/dev-tools/tools')).toBe(true);
        expect(isRealApiPath('/api/performance/metrics')).toBe(true);
        expect(isRealApiPath('/api/patterns/code')).toBe(false);
    });

    test('withSource tags object payloads', () => {
        expect(withSource({ ok: true }, 'database')).toEqual({ ok: true, _source: 'database' });
        expect(withSource([1, 2], 'database')).toEqual([1, 2]);
        expect(withSource('hello', 'database')).toBe('hello');
        expect(withSource(null, 'database')).toBeNull();
    });

    test('resolveSnapshotPayload prefers redis over database and sample', async () => {
        const redis = {
            get: jest.fn().mockResolvedValue(JSON.stringify({ cached: true }))
        };
        const fallback = jest.fn();
        const result = await resolveSnapshotPayload({}, 'demo-key', fallback, redis);
        expect(result).toEqual({ cached: true, _source: 'redis' });
        expect(fallback).not.toHaveBeenCalled();
        expect(phase2Integration.readDashboardSnapshot).not.toHaveBeenCalled();
    });

    test('resolveSnapshotPayload writes database hits to redis', async () => {
        phase2Integration.readDashboardSnapshot.mockResolvedValue({ fromDb: true });
        const redis = {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK')
        };
        const fallback = jest.fn();

        const result = await resolveSnapshotPayload({}, 'demo-key', fallback, redis);
        expect(result).toEqual({ fromDb: true, _source: 'database' });
        expect(fallback).not.toHaveBeenCalled();
        expect(redis.set).toHaveBeenCalled();
    });

    test('resolveSnapshotPayload falls back to sample data', async () => {
        phase2Integration.readDashboardSnapshot.mockResolvedValue(null);
        const fallback = jest.fn().mockResolvedValue({ fromSample: true });

        const result = await resolveSnapshotPayload(null, 'demo-key', fallback, null);
        expect(result).toEqual({ fromSample: true, _source: 'sample' });
        expect(fallback).toHaveBeenCalled();
    });

    test('isRealApiPath ignores query params and rejects unknown paths', () => {
        expect(isRealApiPath('/api/settings/overview?x=1')).toBe(true);
        expect(isRealApiPath('/api/unknown/path')).toBe(false);
    });

    test('sendSnapshotOrSample sends resolved payload as json', async () => {
        phase2Integration.readDashboardSnapshot.mockResolvedValue({ db: true });
        const res = { json: jest.fn() };
        await sendSnapshotOrSample(res, {}, 'k', async () => ({ sample: true }), null);
        expect(res.json).toHaveBeenCalledWith({ db: true, _source: 'database' });
    });
});
