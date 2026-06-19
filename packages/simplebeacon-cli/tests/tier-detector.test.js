/**
 * Tests for tier-detector.js with new usage-based pricing tiers.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { detectTier, getTierLimits, PAID_TIERS, FREE_TIERS, TIER_LIMITS } = require('../src/lib/tier-detector');

describe('getTierLimits', () => {
    it('returns developer limits for unknown tier', () => {
        const limits = getTierLimits('unknown');
        assert.strictEqual(limits.maxScansPerPeriod, 100);
        assert.strictEqual(limits.customConfig, false);
        assert.strictEqual(limits.pipelineScans, false);
    });

    it('returns startup limits correctly', () => {
        const limits = getTierLimits('startup');
        assert.strictEqual(limits.maxScansPerPeriod, 2500);
        assert.strictEqual(limits.customConfig, true);
        assert.strictEqual(limits.allowlist, false);
        assert.strictEqual(limits.pipelineScans, true);
    });

    it('returns growth limits with allowlist', () => {
        const limits = getTierLimits('growth');
        assert.strictEqual(limits.maxScansPerPeriod, 10000);
        assert.strictEqual(limits.customConfig, true);
        assert.strictEqual(limits.allowlist, true);
    });

    it('returns enterprise limits as unlimited', () => {
        const limits = getTierLimits('enterprise');
        assert.strictEqual(limits.maxScansPerPeriod, Infinity);
        assert.strictEqual(limits.customConfig, true);
        assert.strictEqual(limits.allowlist, true);
    });
});

describe('detectTier', () => {
    it('returns developer tier when no token/secret provided', () => {
        delete process.env.SIMPLEBEACON_LICENSE_TOKEN;
        delete process.env.SIMPLEBEACON_LICENSE_SECRET;
        const result = detectTier();
        assert.strictEqual(result.tier, 'developer');
        assert.strictEqual(result.paid, false);
        assert.strictEqual(result.limits.maxScansPerPeriod, 100);
    });
});

describe('PAID_TIERS', () => {
    it('includes all new usage-based tiers', () => {
        assert(PAID_TIERS.has('startup'));
        assert(PAID_TIERS.has('growth'));
        assert(PAID_TIERS.has('enterprise'));
    });
});

describe('FREE_TIERS', () => {
    it('includes developer tier', () => {
        assert(FREE_TIERS.has('developer'));
    });
});

describe('TIER_LIMITS', () => {
    it('has all four tiers defined', () => {
        assert('developer' in TIER_LIMITS);
        assert('startup' in TIER_LIMITS);
        assert('growth' in TIER_LIMITS);
        assert('enterprise' in TIER_LIMITS);
    });
});
