const { SNAPSHOT_SEEDS, REAL_API_PATH_PREFIXES } = require('../../server/lib/snapshot-seeds');

describe('snapshot seeds registry', () => {
    test('defines seeds for all self-contained dashboard pages', () => {
        expect(SNAPSHOT_SEEDS.length).toBeGreaterThanOrEqual(50);
        expect(SNAPSHOT_SEEDS.some((seed) => seed.key === 'analytics-full')).toBe(true);
        expect(SNAPSHOT_SEEDS.some((seed) => seed.key === 'debt-analytics-full')).toBe(true);
        expect(SNAPSHOT_SEEDS.some((seed) => seed.key === 'help-faq')).toBe(true);
    });

    test('real API prefixes cover migrated page routes', () => {
        expect(REAL_API_PATH_PREFIXES).toContain('/api/analytics');
        expect(REAL_API_PATH_PREFIXES).toContain('/api/debt-calculator');
        expect(REAL_API_PATH_PREFIXES).toContain('/api/dashboard-home');
        expect(REAL_API_PATH_PREFIXES).toContain('/api/help');
    });
});
