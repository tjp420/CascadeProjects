'use strict';

const Stripe = require('stripe');

function getAppBaseUrl() {
  return (
    process.env.SIMPLEBEACON_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    `http://localhost:${process.env.PORT || 54355}`
  ).replace(/\/$/, '');
}

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return null;
  return Stripe(secret);
}

function resolvePriceId(product) {
  const map = {
    startup_monthly:
      process.env.STRIPE_PRICE_ID_STARTUP_MONTHLY ||
      process.env.SIMPLEBEACON_STARTUP_PRICE_ID,
    startup_annual:
      process.env.STRIPE_PRICE_ID_STARTUP_ANNUAL ||
      process.env.SIMPLEBEACON_STARTUP_ANNUAL_PRICE_ID,
    growth_monthly:
      process.env.STRIPE_PRICE_ID_GROWTH_MONTHLY ||
      process.env.SIMPLEBEACON_GROWTH_PRICE_ID,
    growth_annual:
      process.env.STRIPE_PRICE_ID_GROWTH_ANNUAL ||
      process.env.SIMPLEBEACON_GROWTH_ANNUAL_PRICE_ID,
    teams_monthly:
      process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY ||
      process.env.STRIPE_PRICE_ID ||
      process.env.SIMPLEBEACON_PRO_PRICE_ID,
    teams_annual:
      process.env.STRIPE_PRICE_ID_TEAMS_ANNUAL ||
      process.env.STRIPE_ANNUAL_PRICE_ID ||
      process.env.SIMPLEBEACON_ANNUAL_PROMOTION_ID,
    executive_clearance:
      process.env.STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE ||
      process.env.SIMPLEBEACON_EXECUTIVE_CLEARANCE_ID,
    instant_report:
      process.env.STRIPE_PRICE_ID_INSTANT_REPORT ||
      process.env.SIMPLEBEACON_INSTANT_REPORT_ID,
    eu_ai_act_sprint:
      process.env.STRIPE_PRICE_ID_EU_AI_ACT_SPRINT ||
      process.env.SIMPLEBEACON_EU_AI_ACT_SPRINT_ID,
    continuous_shield:
      process.env.STRIPE_PRICE_ID_CONTINUOUS_SHIELD ||
      process.env.SIMPLEBEACON_CONTINUOUS_SHIELD_ID,
    runtime_shield:
      process.env.STRIPE_PRICE_ID_RUNTIME_SHIELD ||
      process.env.SIMPLEBEACON_RUNTIME_SHIELD_ID
  };
  return map[product] || null;
}

function isValidPriceId(priceId) {
  return typeof priceId === 'string' && priceId.startsWith('price_') && priceId.length > 6;
}

function isValidProductKey(product) {
  return typeof product === 'string' && product.length > 0 && resolvePriceId(product) !== null;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

const VALID_LICENSE_TIERS = new Set([
  'developer', 'startup', 'growth', 'enterprise',
  'executive', 'agency', 'universal', 'euai', 'instant',
  'community', 'operator', 'custom'
]);

function isValidLicenseTier(tier) {
  return typeof tier === 'string' && VALID_LICENSE_TIERS.has(tier.toLowerCase());
}

function checkoutModeForProduct(product) {
  const oneTimeProducts = ['executive_clearance', 'instant_report', 'eu_ai_act_sprint'];
  return oneTimeProducts.includes(product) ? 'payment' : 'subscription';
}

module.exports = {
  getAppBaseUrl,
  getStripeClient,
  resolvePriceId,
  isValidPriceId,
  isValidProductKey,
  isValidEmail,
  isValidLicenseTier,
  VALID_LICENSE_TIERS,
  checkoutModeForProduct
};
