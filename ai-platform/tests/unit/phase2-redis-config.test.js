const { parseRedisUrl, getRedisConfig, isRedisEnabled } = require('../../server/config/redis');

describe('Phase 2 redis config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('parseRedisUrl extracts connection fields', () => {
        const config = parseRedisUrl('redis://cache.example.com:6380/2');
        expect(config).toEqual({
            url: 'redis://cache.example.com:6380/2',
            host: 'cache.example.com',
            port: 6380,
            db: 2
        });
    });

    test('getRedisConfig applies defaults and env overrides', () => {
        process.env.REDIS_URL = 'redis://localhost:6379/1';
        process.env.REDIS_KEY_PREFIX = 'test:';
        process.env.REDIS_SNAPSHOT_TTL_SECONDS = '120';
        const config = getRedisConfig();
        expect(config.url).toBe('redis://localhost:6379/1');
        expect(config.keyPrefix).toBe('test:');
        expect(config.defaultTtlSeconds).toBe(120);
    });

    test('isRedisEnabled respects ENABLE_REDIS, REDIS_URL, and REDIS_HOST', () => {
        delete process.env.ENABLE_REDIS;
        delete process.env.REDIS_URL;
        delete process.env.REDIS_HOST;
        expect(isRedisEnabled()).toBe(false);

        process.env.ENABLE_REDIS = 'true';
        expect(isRedisEnabled()).toBe(true);

        delete process.env.ENABLE_REDIS;
        process.env.REDIS_URL = 'redis://127.0.0.1:6379';
        expect(isRedisEnabled()).toBe(true);
    });
});
