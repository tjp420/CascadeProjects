const { parseDatabaseUrl, getDatabaseConfig, isDatabaseEnabled } = require('../../server/config/database');

describe('Phase 2 database config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('parseDatabaseUrl extracts connection fields', () => {
        const config = parseDatabaseUrl('postgresql://user:pass@db.example.com:5433/mydb');
        expect(config).toEqual({
            host: 'db.example.com',
            port: 5433,
            database: 'mydb',
            user: 'user',
            password: 'pass'
        });
    });

    test('parseDatabaseUrl returns null for invalid URL', () => {
        expect(parseDatabaseUrl('not-a-real-url')).toBeNull();
    });

    test('getDatabaseConfig prefers DATABASE_URL over DB_* vars', () => {
        process.env.DATABASE_URL = 'postgresql://urluser:urlpass@dbhost:5432/urldb';
        process.env.DB_HOST = 'ignored';
        const config = getDatabaseConfig();
        expect(config.host).toBe('dbhost');
        expect(config.database).toBe('urldb');
        expect(config.user).toBe('urluser');
    });

    test('getDatabaseConfig honors explicit overrides', () => {
        delete process.env.DATABASE_URL;
        process.env.DB_HOST = 'env-host';
        const config = getDatabaseConfig({ host: 'override-host', port: 6543, max: 7, password: 'override-pass' });
        expect(config.host).toBe('override-host');
        expect(config.port).toBe(6543);
        expect(config.max).toBe(7);
        expect(config.password).toBe('override-pass');
    });

    test('getDatabaseConfig throws when database enabled without password', () => {
        delete process.env.DATABASE_URL;
        delete process.env.DB_PASSWORD;
        process.env.ENABLE_DATABASE = 'true';
        expect(() => getDatabaseConfig()).toThrow(/DB_PASSWORD/);
    });

    test('isDatabaseEnabled respects ENABLE_DATABASE and DATABASE_URL', () => {
        delete process.env.ENABLE_DATABASE;
        delete process.env.DATABASE_URL;
        delete process.env.DB_HOST;
        expect(isDatabaseEnabled()).toBe(false);

        process.env.ENABLE_DATABASE = 'true';
        expect(isDatabaseEnabled()).toBe(true);
    });

    test('isDatabaseEnabled becomes true when DB_HOST exists', () => {
        delete process.env.ENABLE_DATABASE;
        delete process.env.DATABASE_URL;
        process.env.DB_HOST = 'db.local';
        expect(isDatabaseEnabled()).toBe(true);
    });
});
