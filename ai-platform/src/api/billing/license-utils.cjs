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
    developer_monthly:
      process.env.STRIPE_PRICE_ID_DEVELOPER_MONTHLY ||
      process.env.STRIPE_PRICE_ID_STARTUP_MONTHLY ||
      process.env.SIMPLEBEACON_STARTUP_PRICE_ID,
    developer_annual:
      process.env.STRIPE_PRICE_ID_DEVELOPER_ANNUAL ||
      process.env.STRIPE_PRICE_ID_STARTUP_ANNUAL ||
      process.env.SIMPLEBEACON_STARTUP_ANNUAL_PRICE_ID,
    team_pro_monthly:
      process.env.STRIPE_PRICE_ID_TEAM_PRO_MONTHLY ||
      process.env.STRIPE_PRICE_ID_GROWTH_MONTHLY ||
      process.env.SIMPLEBEACON_GROWTH_PRICE_ID,
    team_pro_annual:
      process.env.STRIPE_PRICE_ID_TEAM_PRO_ANNUAL ||
      process.env.STRIPE_PRICE_ID_GROWTH_ANNUAL ||
      process.env.SIMPLEBEACON_GROWTH_ANNUAL_PRICE_ID,
    pro_monthly:
      process.env.STRIPE_PRICE_ID_PRO_MONTHLY ||
      process.env.SIMPLEBEACON_PRO_PRICE_ID,
    pro_annual:
      process.env.STRIPE_PRICE_ID_PRO_ANNUAL ||
      process.env.SIMPLEBEACON_PRO_ANNUAL_PRICE_ID,
    team_monthly:
      process.env.STRIPE_PRICE_ID_TEAM_MONTHLY ||
      process.env.SIMPLEBEACON_TEAM_PRICE_ID,
    team_annual:
      process.env.STRIPE_PRICE_ID_TEAM_ANNUAL ||
      process.env.SIMPLEBEACON_TEAM_ANNUAL_PRICE_ID,
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
  'developer', 'team_pro', 'enterprise',
  'startup', 'growth',
  'executive', 'agency', 'universal', 'euai', 'instant',
  'community', 'operator', 'custom',
  'free', 'pro', 'team'
]);

function isValidLicenseTier(tier) {
  return typeof tier === 'string' && VALID_LICENSE_TIERS.has(tier.toLowerCase());
}

function checkoutModeForProduct(product) {
  const oneTimeProducts = ['executive_clearance', 'instant_report', 'eu_ai_act_sprint'];
  const subscriptionProducts = ['developer_tier', 'team_pro_tier', 'developer', 'developer_monthly', 'developer_annual', 'team_pro', 'team_pro_monthly', 'team_pro_annual', 'pro_monthly', 'pro_annual', 'team_monthly', 'team_annual', 'startup_monthly', 'startup_annual', 'growth_monthly', 'growth_annual', 'teams_monthly', 'teams_annual', 'continuous_shield', 'runtime_shield'];
  if (oneTimeProducts.includes(product)) return 'payment';
  if (subscriptionProducts.includes(product)) return 'subscription';
  return 'subscription';
}

const PRODUCT_TIER_MAP = {
  instant_report: 'instant',
  executive_clearance: 'executive',
  eu_ai_act_sprint: 'euai',
  custom_plan: 'custom'
};

const PRODUCT_FEATURES_MAP = {
  instant_report: ['instant-report'],
  executive_clearance: ['pdf-generation', 'certificate'],
  eu_ai_act_sprint: ['eu-ai-act', 'pdf-generation', 'certificate'],
  custom_plan: ['custom-plan', 'pdf-generation', 'certificate']
};

const PRODUCT_EXPIRY_MINUTES_MAP = {
  instant_report: 7 * 24 * 60,
  executive_clearance: 90 * 24 * 60,
  eu_ai_act_sprint: 30 * 24 * 60,
  custom_plan: 30 * 24 * 60
};

module.exports = {
  getAppBaseUrl,
  getStripeClient,
  resolvePriceId,
  isValidPriceId,
  isValidProductKey,
  isValidEmail,
  isValidLicenseTier,
  VALID_LICENSE_TIERS,
  checkoutModeForProduct,
  PRODUCT_TIER_MAP,
  PRODUCT_FEATURES_MAP,
  PRODUCT_EXPIRY_MINUTES_MAP
};
