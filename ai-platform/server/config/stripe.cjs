// SPDX-License-Identifier: MIT
/**
 * Stripe Price ID → Tier mapping.
 *
 * New 4-tier model (2026-06):
 *   developer  – Free, no Stripe price needed
 *   startup    – $49/mo metered
 *   growth     – $149/mo metered
 *   enterprise – Custom, contact sales
 *
 * Legacy entries preserved for backward compatibility.
 * Update mappings in this file when Stripe product pricing changes.
 *
 * @license MIT
 */

const STRIPE_TIER_MAP = {
  // --- New 4-tier metered products ---
  'price_pro_monthly': {
    tier: 'pro',
    expiryDays: 30,
    product: 'pro',
    basePrice: 900, // cents
    metered: false
  },
  'price_pro_annual': {
    tier: 'pro',
    expiryDays: 365,
    product: 'pro_annual',
    basePrice: 7900, // cents ($79/yr)
    metered: false
  },
  'price_team_monthly': {
    tier: 'team',
    expiryDays: 30,
    product: 'team',
    basePrice: 1500, // cents per seat
    metered: true
  },
  'price_team_annual': {
    tier: 'team',
    expiryDays: 365,
    product: 'team_annual',
    basePrice: 15000, // cents per seat ($150/yr)
    metered: false
  },
  'price_startup_monthly': {
    tier: 'pro', // mapped to pro tier
    expiryDays: 30,
    product: 'startup',
    basePrice: 4900, // cents
    metered: true,
    legacy: true
  },
  'price_growth_monthly': {
    tier: 'team', // mapped to team tier
    expiryDays: 30,
    product: 'growth',
    basePrice: 14900, // cents
    metered: true,
    legacy: true
  },
  'price_enterprise_annual': {
    tier: 'enterprise',
    expiryDays: 365,
    product: 'enterprise',
    basePrice: null, // custom negotiated
    metered: false
  },
  // --- Legacy (pre-2026-06) — preserved for migration ---
  'price_19_instant_id': {
    tier: 'startup', // migrated from instant_report
    expiryDays: 7,
    product: 'instant_report',
    legacy: true
  },
  'price_499_executive_id': {
    tier: 'startup', // migrated from executive
    expiryDays: 90,
    product: 'executive_clearance',
    legacy: true
  },
  'price_2499_eusprint_id': {
    tier: 'growth', // migrated from eusprint
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
