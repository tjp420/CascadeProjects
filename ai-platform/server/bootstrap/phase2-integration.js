/**
 * Phase 2 — Data integration bootstrap for simplebeacon-server.
 * Wires auth, health checks, optional PostgreSQL, and API auth gate.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../lib/app-logger');
const { readJsonFileCached, readTextFileCached } = require('../lib/json-file-cache');
const rateLimit = require('express-rate-limit');
const DatabaseAdapter = require('../lib/database-adapter');
const {
    authenticate,
    _optionalAuthenticate,
    handleTokenRefresh
} = require('../middleware/auth');
const { handlePhase2Login } = require('../services/phase2-auth-handlers');
const { seedDemoUsers } = require('../services/user-service');
const { getDatabaseConfig, isDatabaseEnabled } = require('../config/database');
const { isRedisEnabled } = require('../config/redis');
const {
    createRedisConnection,
    invalidateSnapshotCache,
    invalidateAllSnapshotCaches,
    redisHealthCheck,
    closeRedis
} = require('../lib/redis-cache');
const { SNAPSHOT_SEEDS, REAL_API_PATH_PREFIXES } = require('../lib/snapshot-seeds');
const { PUBLIC_API_PATHS, _isPublicApiRoute, isPublicApiRequest } = require('./public-api-routes');

function applyApiSecurityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    return next();
}

function shouldLogRuntimeInfo() {
    return process.env.LOG_RUNTIME_INFO === 'true' || process.env.RUNTIME_DEBUG === 'true';
}

const {
    assertAuthConfiguration,
    assertProductionAuthSafety
} = require('../lib/secret-config');

function validatePhase2LoginRequest(req, res, next) {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({
            error: 'Invalid login payload',
            message: 'email and password must be strings'
        });
    }
    if (!email.trim() || !password.trim()) {
        return res.status(400).json({
            error: 'Invalid login payload',
            message: 'email and password are required'
        });
    }
    return next();
}

async function ensurePhase2Schema(db) {
    const schemaDir = path.join(__dirname, '..', 'db');
    for (const file of ['schema-phase2.sql', 'schema-subscription.sql']) {
        const schemaPath = path.join(schemaDir, file);
        if (!fs.existsSync(schemaPath)) continue;
        const sql = readTextFileCached(schemaPath);
        if (!sql) continue;
        await db.query(sql);
    }
}

async function seedDashboardSnapshot(db, key, payload, redis = null) {
    await db.query(
        `INSERT INTO dashboard_snapshots (key, payload, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
        [key, JSON.stringify(payload)]
    );
    if (redis) {
        await invalidateSnapshotCache(redis, key);
    }
}

async function seedDashboardSnapshotsFromSamples(db, webRoot, redis = null) {
    for (const seed of SNAPSHOT_SEEDS) {
        try {
            const samplePath = path.join(webRoot, 'data', seed.file);
            const sample = readJsonFileCached(samplePath);
            if (!sample) continue;
            const payload = seed.pick(sample);
            if (payload != null) {
                await seedDashboardSnapshot(db, seed.key, payload);
            }
        } catch (error) {
            logger.warn(`[Phase2] Snapshot seed skipped for ${seed.key}:`, error.message);
        }
    }
    if (redis) {
        const cleared = await invalidateAllSnapshotCaches(redis);
        if (cleared > 0 && shouldLogRuntimeInfo()) {
            logger.info(`[Phase2] Cleared ${cleared} stale Redis snapshot cache entries`);
        }
    }
}

async function createDatabaseConnection() {
    if (!isDatabaseEnabled()) {
        return { db: null, status: 'disabled' };
    }

    try {
        const db = new DatabaseAdapter(getDatabaseConfig());
        const health = await db.healthCheck();
        if (health.status !== 'healthy') {
            await db.close?.();
            return { db: null, status: 'unavailable', error: health.error };
        }

        if (process.env.ENABLE_DB_AUTO_MIGRATE !== 'false') {
            await ensurePhase2Schema(db);
        }

        if (process.env.SEED_DEMO_USERS !== 'false') {
            await seedDemoUsers(db);
        }

        if (process.env.LOG_QUERIES === 'true' && shouldLogRuntimeInfo()) {
            logger.info('[Phase2] Database query logging enabled (LOG_QUERIES=true)');
        }

        return { db, status: 'connected' };
    } catch (error) {
        logger.warn('[Phase2] Database connection failed:', error.message);
        return { db: null, status: 'unavailable', error: error.message };
    }
}

function installOptionalApiAuth(app) {
    if (process.env.REQUIRE_AUTH !== 'true') {
        return;
    }

    app.use('/api', (req, res, next) => {
        if (isPublicApiRequest(req)) {
            return next();
        }
        return authenticate(req, res, next);
    });

    if (shouldLogRuntimeInfo()) {
        logger.info('[Phase2] API auth gate enabled (REQUIRE_AUTH=true)');
    }
}

async function setupPhase2Integration(app, options = {}) {
    const webRoot = options.webRoot;
    assertAuthConfiguration();
    assertProductionAuthSafety();
    const { db, status: dbStatus, error: dbError } = await createDatabaseConnection();
    const { redis, status: redisStatus, error: redisError } = await createRedisConnection();
    const authWindowMs = Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || (15 * 60 * 1000));
    const authRateLimit = rateLimit({
        windowMs: authWindowMs,
        max: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 15),
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            error: 'Too many authentication attempts',
            message: 'Please wait before trying to sign in again.'
        }
    });
    const refreshRateLimit = rateLimit({
        windowMs: authWindowMs,
        max: Number(process.env.AUTH_REFRESH_RATE_LIMIT_MAX || 30),
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            error: 'Too many refresh attempts',
            message: 'Please wait before requesting another token refresh.'
        }
    });

    app.disable('x-powered-by');
    app.use('/api', applyApiSecurityHeaders);

    app.locals.db = db;
    app.locals.redis = redis;
    app.locals.phase2 = {
        database: dbStatus,
        redis: redisStatus,
        authRequired: process.env.REQUIRE_AUTH === 'true',
        startedAt: new Date().toISOString()
    };

    if (db && webRoot && process.env.SEED_DASHBOARD_SNAPSHOTS !== 'false') {
        try {
            await seedDashboardSnapshotsFromSamples(db, webRoot, redis);
            if (shouldLogRuntimeInfo()) {
                logger.info('[Phase2] Dashboard snapshots seeded');
            }
        } catch (error) {
            logger.warn('[Phase2] Dashboard snapshot seed failed:', error.message);
        }
    }

    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            service: 'simplebeacon-server',
            phase: 2,
            timestamp: new Date().toISOString()
        });
    });

    app.get('/api/health/db', async (req, res) => {
        if (!db) {
            return res.json({
                status: 'disabled',
                enabled: isDatabaseEnabled(),
                message: dbError || 'Database not configured',
                timestamp: new Date().toISOString()
            });
        }

        const health = await db.healthCheck();
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    app.get('/api/health/redis', async (req, res) => {
        if (!redis) {
            return res.json({
                status: 'disabled',
                enabled: isRedisEnabled(),
                message: redisError || 'Redis not configured',
                timestamp: new Date().toISOString()
            });
        }

        const health = await redisHealthCheck(redis);
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
    });

    app.get('/api/platform/status', (req, res) => {
        res.json({
            phase: 2,
            database: dbStatus,
            redis: redisStatus,
            authRequired: process.env.REQUIRE_AUTH === 'true',
            features: {
                database: dbStatus === 'connected',
                redis: redisStatus === 'connected',
                jwtAuth: true,
                demoUsers: true,
                ggufIssuesApi: process.env.ENABLE_GGUF_ISSUES_API !== 'false',
                stubApis: true,
                realApiPaths: REAL_API_PATH_PREFIXES
            },
            timestamp: new Date().toISOString()
        });
    });

    app.post('/api/auth/login', authRateLimit, validatePhase2LoginRequest, handlePhase2Login);
    app.post('/api/auth/refresh', refreshRateLimit, authenticate, handleTokenRefresh);
    app.get('/api/auth/me', authenticate, (req, res) => {
        res.json({
            user: req.user,
            authenticated: true,
            timestamp: new Date().toISOString()
        });
    });
    app.post('/api/auth/logout', (req, res) => {
        res.json({ message: 'Logged out', timestamp: new Date().toISOString() });
    });

    installOptionalApiAuth(app);

    if (shouldLogRuntimeInfo()) {
        logger.info(`[Phase2] Integration ready - database: ${dbStatus}, redis: ${redisStatus}`);
    }
    return { db, dbStatus, redis, redisStatus };
}

async function readDashboardSnapshot(db, key) {
    if (!db) return null;
    try {
        const result = await db.query(
            'SELECT payload FROM dashboard_snapshots WHERE key = $1 LIMIT 1',
            [key]
        );
        return result.rows[0]?.payload || null;
    } catch (error) {
        logger.warn(`[Phase2] Snapshot read failed for ${key}:`, error.message);
        return null;
    }
}

module.exports = {
    setupPhase2Integration,
    readDashboardSnapshot,
    ensurePhase2Schema,
    seedDashboardSnapshot,
    seedDashboardSnapshotsFromSamples,
    applyApiSecurityHeaders,
    PUBLIC_API_PATHS,
    closeRedis
};
