"use strict";

/**
 * Proration Calculator — computes prorated billing adjustments when
 * customers upgrade or downgrade their subscription tier mid-cycle.
 *
 * Proration logic:
 * - Unused time credit: remaining days on old tier are credited at old rate
 * - New tier charge: remaining days on new tier are charged at new rate
 * - Net adjustment = new charge - old credit
 * - Positive = customer owes (upgrade), negative = customer is credited (downgrade)
 *
 * @license MIT
 */

const { STRIPE_TIER_MAP } = require("../config/stripe.cjs");

/**
 * Get the monthly price (in cents) for a given tier.
 * @param {string} tier - Tier name (developer, team_pro, enterprise)
 * @returns {number|null} Monthly price in cents, or null for custom/unknown
 */
function getTierMonthlyPrice(tier) {
  const entry = Object.values(STRIPE_TIER_MAP).find(
    (cfg) =>
      cfg.tier === tier &&
      !cfg.legacy &&
      cfg.product &&
      !cfg.product.includes("annual"),
  );
  return entry?.basePrice ?? null;
}

/**
 * Get the annual price (in cents) for a given tier.
 * @param {string} tier - Tier name
 * @returns {number|null} Annual price in cents, or null
 */
function getTierAnnualPrice(tier) {
  const entry = Object.values(STRIPE_TIER_MAP).find(
    (cfg) =>
      cfg.tier === tier &&
      !cfg.legacy &&
      cfg.product &&
      cfg.product.includes("annual"),
  );
  return entry?.basePrice ?? null;
}

/**
 * Get a human-readable tier name for display.
 * @param {string} tier
 * @returns {string}
 */
function tierDisplayName(tier) {
  const names = {
    developer: "Developer",
    team_pro: "Team Pro",
    enterprise: "Enterprise",
    pro: "Pro (Legacy)",
  };
  return names[tier] || tier;
}

/**
 * Calculate proration for a mid-cycle tier change.
 *
 * @param {Object} opts
 * @param {string} opts.fromTier - Previous tier
 * @param {string} opts.toTier - New tier
 * @param {number} [opts.periodStart] - Unix timestamp (seconds) of current period start
 * @param {number} [opts.periodEnd] - Unix timestamp (seconds) of current period end
 * @param {boolean} [opts.isAnnual] - Whether the subscription is annual
 * @returns {{fromTier:string, toTier:string, isUpgrade:boolean, daysRemaining:number, daysTotal:number, oldDailyRateCents:number, newDailyRateCents:number, creditCents:number, chargeCents:number, netAdjustmentCents:number, netAdjustmentDisplay:string, isUpgrade: boolean}}
 */
function calculateProration(opts = {}) {
  const { fromTier, toTier, periodStart, periodEnd, isAnnual = false } = opts;

  if (!fromTier || !toTier) {
    throw new Error("fromTier and toTier are required");
  }

  const now = Date.now();
  const periodStartMs = periodStart ? periodStart * 1000 : now;
  const periodEndMs = periodEnd
    ? periodEnd * 1000
    : now + 30 * 24 * 60 * 60 * 1000;

  const totalMs = periodEndMs - periodStartMs;
  const remainingMs = Math.max(0, periodEndMs - now);
  const daysTotal = Math.round(totalMs / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.round(remainingMs / (24 * 60 * 60 * 1000));

  const oldPriceCents = isAnnual
    ? getTierAnnualPrice(fromTier)
    : getTierMonthlyPrice(fromTier);
  const newPriceCents = isAnnual
    ? getTierAnnualPrice(toTier)
    : getTierMonthlyPrice(toTier);

  // If we can't resolve prices (e.g. enterprise custom), return what we can
  if (oldPriceCents == null || newPriceCents == null) {
    return {
      fromTier,
      toTier,
      isUpgrade: getTierMonthlyPrice(toTier) > getTierMonthlyPrice(fromTier),
      daysRemaining,
      daysTotal,
      oldDailyRateCents: 0,
      newDailyRateCents: 0,
      creditCents: 0,
      chargeCents: 0,
      netAdjustmentCents: 0,
      netAdjustmentDisplay: "custom",
      isAnnual,
    };
  }

  const cycleDays = isAnnual ? 365 : 30;
  const oldDailyRateCents = Math.round(oldPriceCents / cycleDays);
  const newDailyRateCents = Math.round(newPriceCents / cycleDays);

  const creditCents = oldDailyRateCents * daysRemaining;
  const chargeCents = newDailyRateCents * daysRemaining;
  const netAdjustmentCents = chargeCents - creditCents;

  const isUpgrade = newPriceCents > oldPriceCents;

  const absAmount = Math.abs(netAdjustmentCents);
  const display = `$${(absAmount / 100).toFixed(2)} ${netAdjustmentCents > 0 ? "charge" : "credit"}`;

  return {
    fromTier,
    toTier,
    isUpgrade,
    daysRemaining,
    daysTotal,
    oldDailyRateCents,
    newDailyRateCents,
    creditCents,
    chargeCents,
    netAdjustmentCents,
    netAdjustmentDisplay: display,
    isAnnual,
  };
}

module.exports = {
  calculateProration,
  getTierMonthlyPrice,
  getTierAnnualPrice,
  tierDisplayName,
};
