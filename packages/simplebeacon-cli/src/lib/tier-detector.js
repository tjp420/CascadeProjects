/**
 * Detect the user's SimpleBeacon tier from environment or config.
 * Free/community tier gets limited output to drive upgrades.
 * Now delegates to tier-constants.js for canonical definitions.
 */

const { validateLicenseToken, resolveLicenseToken } = require('./license-token');
const {
  TIER_DEFINITIONS,
  TIER_ALIASES,
  PAID_TIERS,
  FREE_TIERS,
  resolveTier,
  isPaidTier,
  getTierLimits,
  getTierCapability,
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
  const token = process.env.SIMPLEBEACON_LICENSE_TOKEN || resolveLicenseToken() || '';
  const secrets = verificationSecrets();

  if (!token) {
    return { tier: 'developer', paid: false, limits: TIER_LIMITS.developer };
  }

  for (const secret of secrets) {
    const result = validateLicenseToken(token, secret);
    if (result.valid) {
      const rawTier = String(
        result.claims.tier || result.claims.product || 'developer'
      ).toLowerCase();
      const tier = resolveTier(rawTier);
      const paid = isPaidTier(tier);
      const limits = getTierLimits(tier);
      return { tier, paid, claims: result.claims, limits };
    }
  }

  if (secrets.length) {
    return {
      tier: 'developer',
      paid: false,
      error: 'Invalid license token signature',
      limits: TIER_LIMITS.developer,
      tokenPresent: true,
    };
  }

  return {
    tier: 'developer',
    paid: false,
    limits: TIER_LIMITS.developer,
    tokenPresent: true,
    needsRemoteValidation: true,
  };
}

function verificationSecrets() {
  const secrets = [];
  if (process.env.SIMPLEBEACON_LICENSE_SECRET) {
    secrets.push(process.env.SIMPLEBEACON_LICENSE_SECRET);
  }
  return secrets;
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
  TIER_MIGRATION_MAP,
};
