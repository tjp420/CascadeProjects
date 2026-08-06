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
  // --- Current 3-tier products ---
  'price_developer_monthly': {
    tier: 'developer',
    expiryDays: 30,
    product: 'developer',
    basePrice: 4900, // cents ($49/mo)
    metered: false
  },
  'price_developer_annual': {
    tier: 'developer',
    expiryDays: 365,
    product: 'developer_annual',
    basePrice: 49000, // cents ($490/yr)
    metered: false
  },
  'price_team_pro_monthly': {
    tier: 'team_pro',
    expiryDays: 30,
    product: 'team_pro',
    basePrice: 14900, // cents ($149/mo)
    metered: false
  },
  'price_team_pro_annual': {
    tier: 'team_pro',
    expiryDays: 365,
    product: 'team_pro_annual',
    basePrice: 149000, // cents ($1,490/yr)
    metered: false
  },
  'price_enterprise_annual': {
    tier: 'enterprise',
    expiryDays: 365,
    product: 'enterprise',
    basePrice: null, // custom negotiated
    metered: false
  },
  // --- Legacy (pre-2026-01) — preserved for migration ---
  'price_startup_monthly': {
    tier: 'developer', // migrated to developer tier
    expiryDays: 30,
    product: 'developer',
    basePrice: 4900, // cents
    metered: false,
    legacy: true
  },
  'price_growth_monthly': {
    tier: 'team_pro', // migrated to team_pro tier
    expiryDays: 30,
    product: 'team_pro',
    basePrice: 14900, // cents
    metered: false,
    legacy: true
  },
  'price_pro_monthly': {
    tier: 'developer',
    expiryDays: 30,
    product: 'developer',
    basePrice: 900, // cents
    metered: false,
    legacy: true
  },
  'price_pro_annual': {
    tier: 'developer',
    expiryDays: 365,
    product: 'developer_annual',
    basePrice: 7900, // cents ($79/yr)
    metered: false,
    legacy: true
  },
  'price_team_monthly': {
    tier: 'team_pro',
    expiryDays: 30,
    product: 'team_pro',
    basePrice: 1500, // cents per seat
    metered: true,
    legacy: true
  },
  'price_team_annual': {
    tier: 'team_pro',
    expiryDays: 365,
    product: 'team_pro_annual',
    basePrice: 15000, // cents per seat ($150/yr)
    metered: false,
    legacy: true
  },
  'price_19_instant_id': {
    tier: 'developer',
    expiryDays: 7,
    product: 'instant_report',
    legacy: true
  },
  'price_499_executive_id': {
    tier: 'developer',
    expiryDays: 90,
    product: 'executive_clearance',
    legacy: true
  },
  'price_2499_eusprint_id': {
    tier: 'team_pro',
    expiryDays: 30,
    product: 'eu_ai_act_sprint',
    legacy: true
  }
};

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
    (cfg) => cfg.product === product
  );
  return entry || null;
}

/**
 * Report scan usage to Stripe Billing Meter (batch at cycle end).
 * Called by a nightly/weekly cron job or admin endpoint.
 * @param {string} stripeSecretKey - Stripe API secret key.
 * @param {string} subscriptionItemId - Stripe SubscriptionItem ID for metered billing.
 * @param {number} scanCount - Number of scans to report.
 * @returns {Promise<Object>} Stripe API response.
 */
async function reportScanUsageToStripe(stripeSecretKey, subscriptionItemId, scanCount) {
  if (!stripeSecretKey || !subscriptionItemId || typeof scanCount !== 'number' || !Number.isFinite(scanCount)) {
    throw new Error('stripeSecretKey, subscriptionItemId, and scanCount are required');
  }
  const stripe = require('stripe')(stripeSecretKey);
  const usageRecord = await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity: Math.max(0, Math.round(scanCount)),
    timestamp: Math.floor(Date.now() / 1000),
    action: 'set'
  });
  return usageRecord;
}

module.exports = {
  STRIPE_TIER_MAP,
  getTierConfigByPriceId,
  getTierConfigByProduct,
  reportScanUsageToStripe
};
