'use strict';

/**
 * Billing API — proration preview and tier pricing information.
 *
 * POST /proration-preview  — calculate prorated adjustment for a tier change
 * GET  /tiers             — list available tiers with pricing
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth.cjs');
const { calculateProration, getTierMonthlyPrice, getTierAnnualPrice, tierDisplayName } = require('../lib/proration-calculator.cjs');

const router = express.Router();

const billingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many billing requests, please try again later.' },
});

const TIER_ORDER = ['developer', 'team_pro', 'enterprise'];

router.get('/tiers', billingLimiter, authenticate, (req, res) => {
  const tiers = TIER_ORDER.map((tier) => ({
    id: tier,
    name: tierDisplayName(tier),
    monthlyCents: getTierMonthlyPrice(tier),
    annualCents: getTierAnnualPrice(tier),
  }));
  res.json({ success: true, tiers });
});

router.post('/proration-preview', billingLimiter, authenticate, (req, res) => {
  const { fromTier, toTier, periodStart, periodEnd, isAnnual } = req.body || {};

  if (!fromTier || !toTier) {
    return res.status(400).json({ success: false, error: 'fromTier and toTier are required' });
  }

  try {
    const result = calculateProration({
      fromTier,
      toTier,
      periodStart: typeof periodStart === 'number' ? periodStart : undefined,
      periodEnd: typeof periodEnd === 'number' ? periodEnd : undefined,
      isAnnual: Boolean(isAnnual),
    });

    res.json({
      success: true,
      proration: {
        fromTier: result.fromTier,
        toTier: result.toTier,
        fromTierName: tierDisplayName(result.fromTier),
        toTierName: tierDisplayName(result.toTier),
        isUpgrade: result.isUpgrade,
        daysRemaining: result.daysRemaining,
        daysTotal: result.daysTotal,
        oldDailyRateCents: result.oldDailyRateCents,
        newDailyRateCents: result.newDailyRateCents,
        creditCents: result.creditCents,
        chargeCents: result.chargeCents,
        netAdjustmentCents: result.netAdjustmentCents,
        netAdjustmentDisplay: result.netAdjustmentDisplay,
        isAnnual: result.isAnnual,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
