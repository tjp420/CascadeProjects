/**
 * Stripe Price ID → Tier mapping.
 *
 * Replace the placeholder keys below with real Price IDs from your
 * Stripe Dashboard (Products → Select a product → Pricing → Price ID).
 */

const STRIPE_TIER_MAP = {
  'price_19_instant_id': {
    tier: 'Instant Report',
    expiryDays: 7,
    product: 'instant_report'
  },
  'price_499_executive_id': {
    tier: 'Executive Risk Certificate',
    expiryDays: 90,
    product: 'executive_clearance'
  },
  'price_2499_eusprint_id': {
    tier: 'EU AI Act Sprint',
    expiryDays: 30,
    product: 'eu_ai_act_sprint'
  }
};

/**
 * Resolve tier config by Stripe Price ID.
 * Falls back to null if the Price ID is unknown.
 */
function getTierConfigByPriceId(priceId) {
  return STRIPE_TIER_MAP[priceId] || null;
}

/**
 * Resolve tier config by internal product key.
 * Used when the Price ID is not yet mapped.
 */
function getTierConfigByProduct(product) {
  const entry = Object.values(STRIPE_TIER_MAP).find(
    (cfg) => cfg.product === product
  );
  return entry || null;
}

module.exports = {
  STRIPE_TIER_MAP,
  getTierConfigByPriceId,
  getTierConfigByProduct
};
