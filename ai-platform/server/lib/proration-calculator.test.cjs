'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { calculateProration, getTierMonthlyPrice, getTierAnnualPrice, tierDisplayName } = require('../lib/proration-calculator.cjs');

describe('proration-calculator', () => {

  describe('getTierMonthlyPrice', () => {
    it('returns 4900 for developer tier', () => {
      assert.strictEqual(getTierMonthlyPrice('developer'), 4900);
    });

    it('returns 14900 for team_pro tier', () => {
      assert.strictEqual(getTierMonthlyPrice('team_pro'), 14900);
    });

    it('returns null for enterprise tier (custom pricing)', () => {
      assert.strictEqual(getTierMonthlyPrice('enterprise'), null);
    });
  });

  describe('getTierAnnualPrice', () => {
    it('returns 49000 for developer annual', () => {
      assert.strictEqual(getTierAnnualPrice('developer'), 49000);
    });

    it('returns 149000 for team_pro annual', () => {
      assert.strictEqual(getTierAnnualPrice('team_pro'), 149000);
    });
  });

  describe('tierDisplayName', () => {
    it('returns display names for known tiers', () => {
      assert.strictEqual(tierDisplayName('developer'), 'Developer');
      assert.strictEqual(tierDisplayName('team_pro'), 'Team Pro');
      assert.strictEqual(tierDisplayName('enterprise'), 'Enterprise');
    });

    it('returns the input for unknown tiers', () => {
      assert.strictEqual(tierDisplayName('custom_tier'), 'custom_tier');
    });
  });

  describe('calculateProration', () => {
    it('detects upgrade from developer to team_pro', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'team_pro',
        periodStart: now - 10 * 24 * 60 * 60,
        periodEnd: now + 20 * 24 * 60 * 60,
      });
      assert.strictEqual(result.isUpgrade, true);
      assert.ok(result.daysRemaining > 0);
      assert.ok(result.netAdjustmentCents > 0, 'upgrade should result in a charge');
    });

    it('detects downgrade from team_pro to developer', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'team_pro',
        toTier: 'developer',
        periodStart: now - 10 * 24 * 60 * 60,
        periodEnd: now + 20 * 24 * 60 * 60,
      });
      assert.strictEqual(result.isUpgrade, false);
      assert.ok(result.netAdjustmentCents < 0, 'downgrade should result in a credit');
    });

    it('returns zero adjustment when tiers are the same price', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'developer',
        periodStart: now - 5 * 24 * 60 * 60,
        periodEnd: now + 25 * 24 * 60 * 60,
      });
      assert.strictEqual(result.netAdjustmentCents, 0);
    });

    it('calculates correct daily rates for monthly cycle', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'team_pro',
        periodStart: now,
        periodEnd: now + 30 * 24 * 60 * 60,
        isAnnual: false,
      });
      assert.strictEqual(result.oldDailyRateCents, Math.round(4900 / 30));
      assert.strictEqual(result.newDailyRateCents, Math.round(14900 / 30));
    });

    it('calculates correct daily rates for annual cycle', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'team_pro',
        periodStart: now,
        periodEnd: now + 365 * 24 * 60 * 60,
        isAnnual: true,
      });
      assert.strictEqual(result.oldDailyRateCents, Math.round(49000 / 365));
      assert.strictEqual(result.newDailyRateCents, Math.round(149000 / 365));
    });

    it('produces a human-readable netAdjustmentDisplay', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'team_pro',
        periodStart: now,
        periodEnd: now + 30 * 24 * 60 * 60,
      });
      assert.ok(result.netAdjustmentDisplay.includes('$'));
      assert.ok(result.netAdjustmentDisplay.includes('charge'));
    });

    it('shows "credit" in display for downgrades', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'team_pro',
        toTier: 'developer',
        periodStart: now,
        periodEnd: now + 30 * 24 * 60 * 60,
      });
      assert.ok(result.netAdjustmentDisplay.includes('credit'));
    });

    it('handles enterprise tier with custom pricing', () => {
      const now = Math.floor(Date.now() / 1000);
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'enterprise',
        periodStart: now,
        periodEnd: now + 30 * 24 * 60 * 60,
      });
      assert.strictEqual(result.netAdjustmentCents, 0);
      assert.strictEqual(result.netAdjustmentDisplay, 'custom');
    });

    it('throws if fromTier or toTier is missing', () => {
      assert.throws(() => calculateProration({}), /fromTier and toTier are required/);
      assert.throws(() => calculateProration({ fromTier: 'developer' }), /fromTier and toTier are required/);
    });

    it('defaults period to 30 days when not provided', () => {
      const result = calculateProration({
        fromTier: 'developer',
        toTier: 'team_pro',
      });
      assert.ok(result.daysTotal > 0);
      assert.ok(result.daysRemaining >= 0);
    });
  });
});
