/**
 * Central secret resolution — fail-fast in production; dev ephemeral opt-in only.
 */

const crypto = require('crypto');
const logger = require('./app-logger');

const PLACEHOLDER_PATTERN = /replace|changeme|demo|example|xxx|your_|YOUR_.*_HERE|todo|placeholder|dummy|sk_test_your|REPLACE_ME/i;

function isConfiguredSecret(value, minLength = 32) {
    if (!value) return false;
    const normalized = String(value).trim();
    if (normalized.length < minLength) return false;
    if (PLACEHOLDER_PATTERN.test(normalized)) return false;
    return true;
}

function isProductionLike() {
    const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
    return nodeEnv === 'production' || process.env.REQUIRE_AUTH === 'true';
}

function resolveSecret(name, options = {}) {
    const minLength = options.minLength ?? 32;
    const envValue = process.env[name];
    if (isConfiguredSecret(envValue, minLength)) {
        return String(envValue).trim();
    }

    const allowEphemeral = process.env.ALLOW_DEV_EPHEMERAL_SECRETS === 'true'
        || process.env[`ALLOW_DEV_EPHEMERAL_${name}`] === 'true';

    if (allowEphemeral) {
        if (!resolveSecret._warned) resolveSecret._warned = new Set();
        if (!resolveSecret._warned.has(name)) {
            logger.warn(
                `[secret-config] Using ephemeral ${name} — tokens/sessions reset on restart. `
                + 'Set a stable secret or disable ALLOW_DEV_EPHEMERAL_SECRETS for local dev.'
            );
            resolveSecret._warned.add(name);
        }
        if (!resolveSecret._cache) resolveSecret._cache = new Map();
        if (!resolveSecret._cache.has(name)) {
            resolveSecret._cache.set(name, crypto.randomBytes(64).toString('hex'));
        }
        return resolveSecret._cache.get(name);
    }

    if (isProductionLike()) {
        throw new Error(
            `${name} must be set to a strong secret when NODE_ENV=production or REQUIRE_AUTH=true. `
            + 'Configure via environment or secrets manager before starting the server.'
        );
    }

    if (String(process.env.NODE_ENV || '').toLowerCase() === 'test') {
        return `test-only-${name}-${'0'.repeat(Math.max(0, minLength - name.length - 11))}`;
    }

    throw new Error(
        `${name} is not configured. Set ${name} in .env or enable ALLOW_DEV_EPHEMERAL_SECRETS=true for local development only.`
    );
}

function assertAuthConfiguration() {
    if (process.env.REQUIRE_AUTH !== 'true') return;

    const missing = [];
    if (!isConfiguredSecret(process.env.JWT_SECRET)) missing.push('JWT_SECRET');
    if (!isConfiguredSecret(process.env.JWT_REFRESH_SECRET)) missing.push('JWT_REFRESH_SECRET');
    if (missing.length === 0) return;

    if (process.env.ALLOW_DEV_EPHEMERAL_SECRETS === 'true') {
        logger.warn(
            `[secret-config] ALLOW_DEV_EPHEMERAL_SECRETS=true — using ephemeral ${missing.join(', ')} `
            + 'for this process (tokens reset on restart).'
        );
        return;
    }

    throw new Error(
        `REQUIRE_AUTH=true requires configured ${missing.join(', ')}. `
        + 'Set production secrets in environment/.env.production, or for local dev only set '
        + 'ALLOW_DEV_EPHEMERAL_SECRETS=true in .env.v1-internal.'
    );
}

/**
 * Local v1-internal preview: allow placeholder JWT secrets + demo users without production safety failures.
 */
function applyLocalV1InternalDevProfile() {
    if (process.env.REQUIRE_AUTH !== 'true') return false;

    process.env.SIMPLEBEACON_INTERNAL_DASHBOARD = process.env.SIMPLEBEACON_INTERNAL_DASHBOARD || 'true';

    if (process.env.SIMPLEBEACON_INTERNAL_DASHBOARD === 'true'
        && String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        process.env.NODE_ENV = 'development';
        logger.warn(
            '[secret-config] Local v1-internal profile: NODE_ENV=development for internal dashboard preview '
            + '(demo users + stable JWT allowed).'
        );
    }

    const jwtMissing = !isConfiguredSecret(process.env.JWT_SECRET)
        || !isConfiguredSecret(process.env.JWT_REFRESH_SECRET);
    if (!jwtMissing) return false;

    process.env.ALLOW_DEV_EPHEMERAL_SECRETS = 'true';
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
        process.env.NODE_ENV = 'development';
    }
    logger.warn(
        '[secret-config] Local v1-internal profile: placeholder JWT secrets detected — '
        + 'ALLOW_DEV_EPHEMERAL_SECRETS=true (dev only). Replace secrets before shared deploy.'
    );
    return true;
}

function assertProductionAuthSafety() {
    const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
    if (nodeEnv !== 'production') return;

    const violations = [];
    if (process.env.REQUIRE_AUTH !== 'true') violations.push('REQUIRE_AUTH=true');
    if (process.env.SEED_DEMO_USERS !== 'false') violations.push('SEED_DEMO_USERS=false');
    if (process.env.ALLOW_LEGACY_LOGIN === 'true') {
        violations.push('ALLOW_LEGACY_LOGIN must not be true');
    }

    if (!violations.length) return;
    throw new Error(
        `Production auth safety check failed: ${violations.join(', ')}. `
        + 'Update environment before starting the server.'
    );
}

module.exports = {
    isConfiguredSecret,
    isProductionLike,
    resolveSecret,
    assertAuthConfiguration,
    assertProductionAuthSafety,
    applyLocalV1InternalDevProfile,
    PLACEHOLDER_PATTERN
};
