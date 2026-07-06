/**
 * Detect the user's SimpleBeacon tier from environment or config.
 * Free/community tier gets limited output to drive upgrades.
 * Now delegates to tier-constants.js for canonical definitions.
 */

const { validateLicenseToken } = require('./license-token');
const {
    TIER_DEFINITIONS,
    TIER_ALIASES,
    PAID_TIERS,
    FREE_TIERS,
    resolveTier,
    isPaidTier,
    getTierLimits,
    getTierCapability
} = require('./tier-constants');

/** @deprecated kept for backward compat; use resolveTier() */
const TIER_MIGRATION_MAP = TIER_ALIASES;

/** @deprecated kept for backward compat; use resolveTier() */
function migrateTierName(tier) {
    return resolveTier(tier);
}

/** @deprecated kept for backward compat; use TIER_DEFINITIONS */
const TIER_LIMITS = TIER_DEFINITIONS;

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
    const tier = resolveTier(rawTier);
    const paid = isPaidTier(tier);
    const limits = getTierLimits(tier);
    return { tier, paid, claims: result.claims, limits };
}

module.exports = {
    detectTier,
    getTierLimits,
    getTierCapability,
    resolveTier,
    isPaidTier,
    migrateTierName,
    PAID_TIERS,
    FREE_TIERS,
    TIER_LIMITS,
    TIER_MIGRATION_MAP
};
