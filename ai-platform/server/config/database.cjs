/**
 * Unified database configuration for Phase 2 integration.
 * Supports DATABASE_URL and individual DB_* environment variables.
 */

const logger = require('../lib/app-logger.cjs');

function parseDatabaseUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parsed.port ? Number(parsed.port) : 5432,
            database: parsed.pathname.replace(/^\//, ''),
            user: decodeURIComponent(parsed.username || ''),
            password: decodeURIComponent(parsed.password || '')
        };
    } catch (error) {
        logger.warn('[DB] Invalid DATABASE_URL:', error.message);
        return null;
    }
}

function resolveDatabasePassword(fromUrl, overrides = {}) {
    const password = overrides.password ?? fromUrl?.password ?? process.env.DB_PASSWORD;
    if (password != null && String(password).length > 0) {
        return String(password);
    }
    const enabled = process.env.ENABLE_DATABASE === 'true'
        || Boolean(process.env.DATABASE_URL)
        || process.env.DB_HOST != null;
    if (enabled) {
        throw new Error(
            'Database is enabled but DB_PASSWORD (or DATABASE_URL with password) is not set. '
            + 'Configure credentials via environment — do not rely on hardcoded defaults.'
        );
    }
    return '';
}

function getDatabaseConfig(overrides = {}) {
    const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL);
    return {
        host: overrides.host || fromUrl?.host || process.env.DB_HOST || 'localhost',
        port: Number(overrides.port || fromUrl?.port || process.env.DB_PORT || 5432),
        database: overrides.database || fromUrl?.database || process.env.DB_NAME || 'cascade_ai_platform',
        user: overrides.user || fromUrl?.user || process.env.DB_USER || 'cascade_user',
        password: resolveDatabasePassword(fromUrl, overrides),
        max: Number(process.env.DB_POOL_MAX || overrides.max || 20),
        idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
        connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS || 2000)
    };
}

function isDatabaseEnabled() {
    return process.env.ENABLE_DATABASE === 'true'
        || Boolean(process.env.DATABASE_URL)
        || process.env.DB_HOST != null;
}

module.exports = {
    parseDatabaseUrl,
    getDatabaseConfig,
    isDatabaseEnabled
};
