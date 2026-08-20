// SPDX-License-Identifier: MIT
/**
 * Stripe Price ID → Tier mapping.
 *
 * New 3-tier model (2026-01):
 *   developer  – $49/mo ($490/yr)
 *   team_pro   – $149/mo ($1,490/yr)
 *   enterprise – Custom, contact sales
 *
 * Legacy entries preserved for backward compatibility.
 * Update mappings in this file when Stripe product pricing changes.
 *
 * @license MIT
 */

const STRIPE_TIER_MAP = {
  // --- Current 3-tier products (live Stripe Price IDs, 2026-08-09) ---
  price_1U2flyAQ0e20kzI8Y8CYxUWt: {
    tier: "developer",
    expiryDays: 30,
    product: "developer",
    basePrice: 4900, // cents ($49/mo)
    metered: false,
  },
  price_1U2fmaAQ0e20kzI8YQImSRpQ: {
    tier: "developer",
    expiryDays: 365,
    product: "developer_annual",
    basePrice: 49000, // cents ($490/yr)
    metered: false,
  },
  price_1U2fn7AQ0e20kzI8lXYh295F: {
    tier: "team_pro",
    expiryDays: 30,
    product: "team_pro",
    basePrice: 14900, // cents ($149/mo)
    metered: false,
  },
  price_1U2fnYAQ0e20kzI8EI2LjRQC: {
    tier: "team_pro",
    expiryDays: 365,
    product: "team_pro_annual",
    basePrice: 149000, // cents ($1,490/yr)
    metered: false,
  },
  price_enterprise_annual: {
    tier: "enterprise",
    expiryDays: 365,
    product: "enterprise",
    basePrice: null, // custom negotiated
    metered: false,
  },
  // --- Legacy (pre-2026-01) — preserved for migration ---
  price_startup_monthly: {
    tier: "developer", // migrated to developer tier
    expiryDays: 30,
    product: "developer",
    basePrice: 4900, // cents
    metered: false,
    legacy: true,
  },
  price_growth_monthly: {
    tier: "team_pro", // migrated to team_pro tier
    expiryDays: 30,
    product: "team_pro",
    basePrice: 14900, // cents
    metered: false,
    legacy: true,
  },
  price_pro_monthly: {
    tier: "developer",
    expiryDays: 30,
    product: "developer",
    basePrice: 900, // cents
    metered: false,
    legacy: true,
  },
  price_pro_annual: {
    tier: "developer",
    expiryDays: 365,
    product: "developer_annual",
    basePrice: 7900, // cents ($79/yr)
    metered: false,
    legacy: true,
  },
  price_team_monthly: {
    tier: "team_pro",
    expiryDays: 30,
    product: "team_pro",
    basePrice: 1500, // cents per seat
    metered: true,
    legacy: true,
  },
  price_team_annual: {
    tier: "team_pro",
    expiryDays: 365,
    product: "team_pro_annual",
    basePrice: 15000, // cents per seat ($150/yr)
    metered: false,
    legacy: true,
  },
  price_19_instant_id: {
    tier: "developer",
    expiryDays: 7,
    product: "instant_report",
    legacy: true,
  },
  price_499_executive_id: {
    tier: "developer",
    expiryDays: 90,
    product: "executive_clearance",
    legacy: true,
  },
  price_2499_eusprint_id: {
    tier: "team_pro",
    expiryDays: 30,
    product: "eu_ai_act_sprint",
    legacy: true,
  },
};

/**
 * Seat capacity per tier.
 * Developer = 1 seat (single user), Team Pro = 5 seats, Enterprise = custom.
 * Used by the license seat management dashboard to enforce seat limits.
 */
const TIER_SEAT_MAP = {
  developer: 1,
  team_pro: 5,
  enterprise: Infinity, // custom — set during org onboarding
  // Legacy tiers
  pro: 1,
  team: 10,
  startup: 1,
  growth: 5,
  free: 1,
};

/**
 * Get the seat capacity for a given tier.
 * @param {string} tier - Tier name (developer, team_pro, enterprise)
 * @returns {number} Seat capacity (Infinity for unlimited/custom)
 */
function getTierSeatLimit(tier) {
  return TIER_SEAT_MAP[tier] ?? 1;
}

/**
 * Resolve tier config by Stripe Price ID.
 * Falls back to null if the Price ID is unknown.
 * @param {string} priceId - Stripe Price ID.
 * @returns {{tier:string,expiryDays:number,product:string}|null}
 */
function getTierConfigByPriceId(priceId) {
  return STRIPE_TIER_MAP[priceId] || null;
}

/**
 * Resolve tier config by internal product key.
 * Used when the Price ID is not yet mapped.
 * @param {string} product - Internal product key.
 * @returns {{tier:string,expiryDays:number,product:string}|null}
 */
function getTierConfigByProduct(product) {
  const entry = Object.values(STRIPE_TIER_MAP).find(
    (cfg) => cfg.product === product,
  );
  return entry || null;
}

// Backwards-compatible aliases for legacy/test price IDs used in unit tests and fixtures
// Map stable legacy keys (e.g., price_developer_monthly) to the current live price entries
try {
  STRIPE_TIER_MAP.price_developer_monthly = STRIPE_TIER_MAP['price_1U2flyAQ0e20kzI8Y8CYxUWt'];
  STRIPE_TIER_MAP.price_developer_annual = STRIPE_TIER_MAP['price_1U2fmaAQ0e20kzI8YQImSRpQ'];
  STRIPE_TIER_MAP.price_team_pro_monthly = STRIPE_TIER_MAP['price_1U2fn7AQ0e20kzI8lXYh295F'];
  STRIPE_TIER_MAP.price_team_pro_annual = STRIPE_TIER_MAP['price_1U2fnYAQ0e20kzI8EI2LjRQC'];
} catch (e) {
  // In environments where the live price IDs are not present (e.g., minimal test fixtures),
  // it's safe to ignore and rely on legacy keys already present in the map.
}

/**
 * Report scan usage to Stripe Billing Meter (batch at cycle end).
 * Called by a nightly/weekly cron job or admin endpoint.
 * @param {string} stripeSecretKey - Stripe API secret key.
 * @param {string} subscriptionItemId - Stripe SubscriptionItem ID for metered billing.
 * @param {number} scanCount - Number of scans to report.
 * @returns {Promise<Object>} Stripe API response.
 */
async function reportScanUsageToStripe(
  stripeSecretKey,
  subscriptionItemId,
  scanCount,
) {
  if (
    !stripeSecretKey ||
    !subscriptionItemId ||
    typeof scanCount !== "number" ||
    !Number.isFinite(scanCount)
  ) {
    throw new Error(
      "stripeSecretKey, subscriptionItemId, and scanCount are required",
    );
  }
  const stripe = require("stripe")(stripeSecretKey);
  const usageRecord = await stripe.subscriptionItems.createUsageRecord(
    subscriptionItemId,
    {
      quantity: Math.max(0, Math.round(scanCount)),
      timestamp: Math.floor(Date.now() / 1000),
      action: "set",
    },
  );
  return usageRecord;
}

module.exports = {
  STRIPE_TIER_MAP,
  TIER_SEAT_MAP,
  getTierSeatLimit,
  getTierConfigByPriceId,
  getTierConfigByProduct,
  reportScanUsageToStripe,
};
