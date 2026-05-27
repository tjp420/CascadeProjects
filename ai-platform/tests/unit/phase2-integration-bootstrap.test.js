const express = require('express');
const os = require('os');
const path = require('path');

jest.mock('../../server/lib/database-adapter', () => jest.fn());
jest.mock('../../server/config/database', () => ({
    getDatabaseConfig: jest.fn(() => ({ host: 'localhost' })),
    isDatabaseEnabled: jest.fn(() => false)
}));
jest.mock('../../server/config/redis', () => ({
    isRedisEnabled: jest.fn(() => false)
}));
jest.mock('../../server/lib/redis-cache', () => ({
    createRedisConnection: jest.fn(async () => ({ redis: null, status: 'disabled', error: null })),
    invalidateSnapshotCache: jest.fn(async () => {}),
    invalidateAllSnapshotCaches: jest.fn(async () => 0),
    redisHealthCheck: jest.fn(async () => ({ status: 'healthy' })),
    closeRedis: jest.fn(async () => {})
}));
jest.mock('../../server/services/phase2-auth-handlers', () => ({
    handlePhase2Login: (req, res) => res.status(501).json({ error: 'stub login' })
}));
jest.mock('../../server/services/user-service', () => ({
    seedDemoUsers: jest.fn(async () => {})
}));
jest.mock('../../server/middleware/auth', () => ({
    authenticate: (req, res, next) => next(),
    optionalAuthenticate: (req, res, next) => next(),
    handleTokenRefresh: (req, res) => res.json({ refreshed: true })
}));
jest.mock('../../server/lib/snapshot-seeds', () => ({
    SNAPSHOT_SEEDS: [
        { key: 'ok-key', file: 'ok.json', pick: (sample) => sample.payload },
        { key: 'bad-key', file: 'bad.json', pick: (sample) => sample.payload }
    ],
    REAL_API_PATH_PREFIXES: ['/api/health']
}));

const fs = require('fs');
const DatabaseAdapter = require('../../server/lib/database-adapter');
const databaseConfig = require('../../server/config/database');
const redisConfig = require('../../server/config/redis');
const redisCache = require('../../server/lib/redis-cache');
const { seedDemoUsers } = require('../../server/services/user-service');
const {
    setupPhase2Integration,
    ensurePhase2Schema,
    seedDashboardSnapshotsFromSamples,
    readDashboardSnapshot,
    applyApiSecurityHeaders
} = require('../../server/bootstrap/phase2-integration');

async function withServer(app, fn) {
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    try {
        await fn(baseUrl);
    } finally {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
}

describe('phase2 integration bootstrap branches', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('ensurePhase2Schema executes only existing schema files', async () => {
        const db = { query: jest.fn(async () => {}) };
        jest.spyOn(fs, 'existsSync').mockImplementation((p) => String(p).includes('schema-phase2.sql'));
        jest.spyOn(fs, 'readFileSync').mockImplementation(() => 'SELECT 1;');

        await ensurePhase2Schema(db);

        expect(db.query).toHaveBeenCalledTimes(1);
        expect(db.query).toHaveBeenCalledWith('SELECT 1;');
    });

    test('seedDashboardSnapshotsFromSamples seeds valid files and skips parse failures', async () => {
        const db = { query: jest.fn(async () => {}) };
        const redis = { get: jest.fn(), set: jest.fn() };
        const webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-web-seed-'));
        const dataDir = path.join(webRoot, 'data');
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'ok.json'), JSON.stringify({ payload: { ok: true } }));
        fs.writeFileSync(path.join(dataDir, 'bad.json'), 'not-json');
        redisCache.invalidateAllSnapshotCaches.mockResolvedValueOnce(3);

        await seedDashboardSnapshotsFromSamples(db, webRoot, redis);

        expect(db.query).toHaveBeenCalled();
        expect(redisCache.invalidateAllSnapshotCaches).toHaveBeenCalledWith(redis);
    });

    test('setupPhase2Integration handles unavailable database adapter', async () => {
        databaseConfig.isDatabaseEnabled.mockReturnValue(true);
        DatabaseAdapter.mockImplementation(() => {
            throw new Error('db init failed');
        });
        redisCache.createRedisConnection.mockResolvedValueOnce({ redis: null, status: 'disabled', error: 'none' });

        const app = express();
        app.use(express.json());
        const result = await setupPhase2Integration(app, { webRoot: 'C:/tmp/web' });

        expect(result.db).toBeNull();
        expect(result.dbStatus).toBe('unavailable');
        expect(app.locals.phase2.database).toBe('unavailable');
    });

    test('health routes return 503 when connected dependencies become unhealthy', async () => {
        databaseConfig.isDatabaseEnabled.mockReturnValue(true);
        redisConfig.isRedisEnabled.mockReturnValue(true);
        process.env.ENABLE_DB_AUTO_MIGRATE = 'false';
        process.env.SEED_DEMO_USERS = 'false';

        const db = {
            query: jest.fn(async () => ({ rows: [] })),
            healthCheck: jest
                .fn()
                .mockResolvedValueOnce({ status: 'healthy' })
                .mockResolvedValue({ status: 'down', message: 'degraded' })
        };
        DatabaseAdapter.mockImplementation(() => db);
        const redis = { get: jest.fn(), set: jest.fn() };
        redisCache.createRedisConnection.mockResolvedValueOnce({ redis, status: 'connected', error: null });
        redisCache.redisHealthCheck.mockResolvedValueOnce({ status: 'down', message: 'redis degraded' });

        const app = express();
        app.use(express.json());
        await setupPhase2Integration(app, { webRoot: 'C:/tmp/web' });

        await withServer(app, async (baseUrl) => {
            const dbHealth = await fetch(`${baseUrl}/api/health/db`);
            expect(dbHealth.status).toBe(503);
            const dbPayload = await dbHealth.json();
            expect(dbPayload.status).toBe('down');

            const redisHealth = await fetch(`${baseUrl}/api/health/redis`);
            expect(redisHealth.status).toBe(503);
            const redisPayload = await redisHealth.json();
            expect(redisPayload.status).toBe('down');
        });

        expect(seedDemoUsers).not.toHaveBeenCalled();
    });

    test('readDashboardSnapshot returns null on query failure', async () => {
        const db = {
            query: jest.fn(async () => {
                throw new Error('query failed');
            })
        };
        const payload = await readDashboardSnapshot(db, 'missing-key');
        expect(payload).toBeNull();
    });

    test('applyApiSecurityHeaders sets baseline headers', () => {
        const headers = {};
        const req = {};
        const res = {
            setHeader: (key, value) => {
                headers[key] = value;
            }
        };
        const next = jest.fn();
        delete process.env.NODE_ENV;

        applyApiSecurityHeaders(req, res, next);

        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
        expect(headers['Permissions-Policy']).toContain('camera=()');
        expect(headers['Strict-Transport-Security']).toBeUndefined();
        expect(next).toHaveBeenCalled();
    });

    test('applyApiSecurityHeaders sets HSTS in production', () => {
        const previousEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const headers = {};
        const req = {};
        const res = {
            setHeader: (key, value) => {
                headers[key] = value;
            }
        };
        const next = jest.fn();

        applyApiSecurityHeaders(req, res, next);

        expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
        expect(next).toHaveBeenCalled();
        process.env.NODE_ENV = previousEnv;
    });
});
