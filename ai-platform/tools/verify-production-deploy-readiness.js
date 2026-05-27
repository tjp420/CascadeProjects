#!/usr/bin/env node
/**
 * Production deploy readiness — filesystem checks before shipping simplebeacon.ai.
 * Does not SSH to host or call Stripe; run on the deployment machine with real secrets.
 */
const fs = require('fs');
const path = require('path');
const { readEnvFileFlags, isConfiguredSecret } = require('../server/lib/code-roadmap-generator');

const ROOT = path.join(__dirname, '..');
const checks = [];

function pass(label, detail) {
    checks.push({ label, ok: true, detail });
}

function warn(label, detail) {
    checks.push({ label, ok: true, warn: true, detail });
}

function fail(label, detail) {
    checks.push({ label, ok: false, detail });
}

const requiredFiles = [
    ['.env.production.example', 'production env template'],
    ['scripts/deploy-simplebeacon.sh', 'deploy script'],
    ['docker/cloudflared/config.yml', 'Cloudflare tunnel config'],
    ['docker/nginx/simplebeacon.conf', 'nginx config'],
    ['docs/v1-internal-runbook.md', 'runbook']
];

for (const [rel, label] of requiredFiles) {
    if (fs.existsSync(path.join(ROOT, rel))) {
        pass(label, rel);
    } else {
        fail(label, `missing ${rel}`);
    }
}

const prodEnvPath = path.join(ROOT, '.env.production');
if (!fs.existsSync(prodEnvPath)) {
    fail('production env file', 'copy .env.production.example → .env.production on host');
} else {
    pass('production env file', '.env.production present');
    const env = readEnvFileFlags(prodEnvPath);
    if (!env) {
        fail('production env parse', 'unable to parse .env.production');
    }

    if (env?.requireAuth) pass('REQUIRE_AUTH', 'true');
    else fail('REQUIRE_AUTH', 'must be true in .env.production');

    if (isConfiguredSecret(env?.jwtSecret)) pass('JWT_SECRET', 'configured');
    else fail('JWT_SECRET', 'set a 32+ char secret (not REPLACE_*)');

    if (isConfiguredSecret(env?.jwtRefreshSecret)) pass('JWT_REFRESH_SECRET', 'configured');
    else fail('JWT_REFRESH_SECRET', 'set a 32+ char secret');

    const jwtExpires = String(env?.jwtExpiresIn || process.env.JWT_EXPIRES_IN || '').trim();
    const refreshExpires = String(env?.refreshTokenExpiresIn || process.env.REFRESH_TOKEN_EXPIRES_IN || '').trim();
    if (jwtExpires) pass('JWT_EXPIRES_IN', jwtExpires);
    else fail('JWT_EXPIRES_IN', 'required in .env.production (example: 7d)');
    if (refreshExpires) pass('REFRESH_TOKEN_EXPIRES_IN', refreshExpires);
    else fail('REFRESH_TOKEN_EXPIRES_IN', 'required in .env.production (example: 30d)');

    if (env?.seedDemoUsers === 'false') pass('SEED_DEMO_USERS', 'false');
    else fail('SEED_DEMO_USERS', 'must be false in production');

    if (env?.allowLegacyLogin === 'true') {
        fail('ALLOW_LEGACY_LOGIN', 'must be false/unset in production');
    } else {
        pass('ALLOW_LEGACY_LOGIN', 'disabled');
    }

    const appUrl = String(env?.appUrl || process.env.SIMPLEBEACON_APP_URL || '').trim();
    if (!appUrl) {
        fail('SIMPLEBEACON_APP_URL', 'required in .env.production (example: https://simplebeacon.ai)');
    } else if (!/^https:\/\//i.test(appUrl)) {
        fail('SIMPLEBEACON_APP_URL', `must use https:// (current: ${appUrl})`);
    } else if (!/simplebeacon\.ai/i.test(appUrl)) {
        fail('SIMPLEBEACON_APP_URL', `must target simplebeacon.ai (current: ${appUrl})`);
    } else {
        pass('SIMPLEBEACON_APP_URL', appUrl);
    }

    const monetizationEnabled = String(env?.monetizationEnabled || '').toLowerCase() === 'true';
    const stripeSecretConfigured = Boolean(env?.stripeSecretKey) && !/replace|\.\.\./i.test(String(env?.stripeSecretKey || ''));
    const stripePriceConfigured = Boolean(env?.stripePriceIdTeamsMonthly || env?.stripePriceId)
        && !/replace|\.\.\./i.test(String(env?.stripePriceIdTeamsMonthly || env?.stripePriceId || ''));
    const stripePriceAnnualConfigured = Boolean(env?.stripePriceIdTeamsAnnual)
        && !/replace|\.\.\./i.test(String(env?.stripePriceIdTeamsAnnual || ''));
    const stripePriceEnterpriseSetupConfigured = Boolean(env?.stripePriceIdEnterpriseSetup)
        && !/replace|\.\.\./i.test(String(env?.stripePriceIdEnterpriseSetup || ''));
    const stripePriceEnterpriseRetainerConfigured = Boolean(env?.stripePriceIdEnterpriseRetainer)
        && !/replace|\.\.\./i.test(String(env?.stripePriceIdEnterpriseRetainer || ''));

    if (!monetizationEnabled) {
        warn('Stripe monetization', 'SIMPLEBEACON_MONETIZATION_ENABLED is not true; checkout is disabled');
    } else if (stripeSecretConfigured && stripePriceConfigured) {
        pass('Stripe keys', 'STRIPE_SECRET_KEY + teams monthly price ID set');
        if (env?.stripeSecretKey?.startsWith('sk_live_') || env?.stripeSecretKey?.startsWith('rk_live_')) {
            pass('Stripe key mode', 'live key detected');
        } else {
            warn('Stripe key mode', 'using test/restricted-test key while monetization is enabled');
        }
        if (env?.stripeWebhookSecret && !/replace|\.\.\./i.test(String(env.stripeWebhookSecret))) {
            pass('STRIPE_WEBHOOK_SECRET', 'configured');
        } else {
            fail('STRIPE_WEBHOOK_SECRET', 'required when monetization is enabled');
        }
        if (env?.stripePublishableKey && /^pk_(test|live)_/.test(String(env.stripePublishableKey))) {
            pass('STRIPE_PUBLISHABLE_KEY', 'configured');
        } else {
            warn('STRIPE_PUBLISHABLE_KEY', 'missing or invalid (recommended for frontend billing flows)');
        }
        if (stripePriceAnnualConfigured) pass('STRIPE_PRICE_ID_TEAMS_ANNUAL', 'configured');
        else warn('STRIPE_PRICE_ID_TEAMS_ANNUAL', 'optional but recommended for annual checkout');
        if (stripePriceEnterpriseSetupConfigured) pass('STRIPE_PRICE_ID_ENTERPRISE_SETUP', 'configured');
        else warn('STRIPE_PRICE_ID_ENTERPRISE_SETUP', 'optional unless enterprise setup checkout is offered');
        if (stripePriceEnterpriseRetainerConfigured) pass('STRIPE_PRICE_ID_ENTERPRISE_RETAINER', 'configured');
        else warn('STRIPE_PRICE_ID_ENTERPRISE_RETAINER', 'optional unless enterprise retainer checkout is offered');
    } else {
        fail(
            'Stripe keys',
            'set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_TEAMS_MONTHLY (or STRIPE_PRICE_ID) when monetization is enabled'
        );
    }

    const corsOrigins = String(env?.corsOrigins || '').trim();
    if (!corsOrigins) {
        fail('CORS_ORIGINS', 'set comma-separated https origins (example: https://simplebeacon.ai,https://www.simplebeacon.ai)');
    } else if (corsOrigins.includes('*')) {
        fail('CORS_ORIGINS', 'must not use wildcard * in production');
    } else if (!/^https:\/\//i.test(corsOrigins.split(',')[0].trim())) {
        fail('CORS_ORIGINS', 'origins must use https:// in production');
    } else {
        pass('CORS_ORIGINS', corsOrigins.split(',').map((entry) => entry.trim()).filter(Boolean).join(', '));
    }

    const databaseEnabled = String(env?.enableDatabase || '').toLowerCase() === 'true';
    if (databaseEnabled) {
        const dbConfigured = Boolean(env?.databaseUrl)
            && !/replace|changeme|secure_password/i.test(String(env.databaseUrl || ''));
        const dbPasswordConfigured = Boolean(env?.dbPassword)
            && !/replace|changeme|secure_password/i.test(String(env.dbPassword || ''));
        if (dbConfigured || dbPasswordConfigured) {
            pass('DATABASE', 'DATABASE_URL or DB_PASSWORD configured');
        } else {
            fail('DATABASE', 'set DATABASE_URL or DB_PASSWORD when ENABLE_DATABASE=true');
        }
    } else {
        warn('DATABASE', 'ENABLE_DATABASE is not true; JSON/file adapters remain active');
    }

    const redisEnabled = String(env?.enableRedis || '').toLowerCase() === 'true';
    if (redisEnabled) {
        const redisConfigured = Boolean(env?.redisUrl)
            && !/replace|changeme/i.test(String(env.redisUrl || ''));
        if (redisConfigured) pass('REDIS', env.redisUrl);
        else fail('REDIS', 'set REDIS_URL when ENABLE_REDIS=true');
    } else {
        warn('REDIS', 'ENABLE_REDIS is not true; snapshot cache disabled');
    }
}

console.log('=== Production deploy readiness ===');
for (const check of checks) {
    const tag = check.ok ? (check.warn ? 'WARN' : 'OK  ') : 'FAIL';
    console.log(`${tag}  ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
}

const blocking = checks.filter((check) => !check.ok);
if (blocking.length) {
    process.exitCode = 1;
    console.log('\nFix blocking items, then: npm run simplebeacon:deploy');
} else {
    console.log('\nReady to deploy. Smoke test: login → scan → pricing → checkout');
}
