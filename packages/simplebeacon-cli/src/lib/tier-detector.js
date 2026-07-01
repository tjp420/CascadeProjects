/**
 * Detect the user's SimpleBeacon tier from environment or config.
 * Free/community tier gets limited output to drive upgrades.
 */

const { validateLicenseToken } = require('./license-token');

const PAID_TIERS = new Set(['startup', 'growth', 'enterprise']);
const FREE_TIERS = new Set(['developer', 'community', 'instant', 'locked', '']);

/** Migrate legacy tier names to new 4-tier model at read time. */
const TIER_MIGRATION_MAP = {
    executive: 'startup',
    euai: 'startup',
    eusprint: 'growth',
    continuous_shield: 'growth',
    universal: 'enterprise',
    custom: 'enterprise',
    community: 'developer',
    instant: 'developer',
    locked: 'developer',
    '': 'developer'
};

function migrateTierName(tier) {
    const raw = String(tier || '').toLowerCase().trim();
    return TIER_MIGRATION_MAP[raw] || raw || 'developer';
}

const TIER_LIMITS = {
    developer: {
        maxScansPerPeriod: 9999,
        customConfig: false,
        allowlist: false,
        maxFilesPerScan: 50,
        maxFindingsShown: 5,
        showQualityScore: false,
        pipelineScans: false
    },
    startup: {
        maxScansPerPeriod: 2500,
        customConfig: true,
        allowlist: false,
        maxFilesPerScan: Infinity,
        maxFindingsShown: Infinity,
        showQualityScore: true,
        pipelineScans: true
    },
    growth: {
        maxScansPerPeriod: 10000,
        customConfig: true,
        allowlist: true,
        maxFilesPerScan: Infinity,
        maxFindingsShown: Infinity,
        showQualityScore: true,
        pipelineScans: true
    },
    enterprise: {
        maxScansPerPeriod: Infinity,
        customConfig: true,
        allowlist: true,
        maxFilesPerScan: Infinity,
        maxFindingsShown: Infinity,
        showQualityScore: true,
        pipelineScans: true
    }
};

function getTierLimits(tier) {
    const normalized = migrateTierName(tier);
    return TIER_LIMITS[normalized] || TIER_LIMITS.developer;
}

function detectTier() {
    const token = process.env.SIMPLEBEACON_LICENSE_TOKEN || '';
    const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || '';

    if (!token || !secret) {
        return { tier: 'developer', paid: false, limits: TIER_LIMITS.developer };
    }

    const result = validateLicenseToken(token, secret);
    if (!result.valid) {
        return { tier: 'developer', paid: false, error: result.error, limits: TIER_LIMITS.developer };
    }

    const rawTier = String(result.claims.tier || result.claims.product || 'developer').toLowerCase();
    const tier = migrateTierName(rawTier);
    const paid = PAID_TIERS.has(tier);
    const limits = getTierLimits(tier);
    return { tier, paid, claims: result.claims, limits };
}

module.exports = { detectTier, getTierLimits, migrateTierName, PAID_TIERS, FREE_TIERS, TIER_LIMITS, TIER_MIGRATION_MAP };
