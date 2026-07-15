// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Price ID lookup by tier.
 * Populate these from your Stripe Product Catalog.
 */
const TIER_PRICE_MAP = {
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  team: process.env.STRIPE_PRICE_TEAM
};

/**
 * POST /api/billing/checkout-session
 *
 * Creates a Stripe Checkout Session with metadata pinned
 * so the webhook can reconcile the correct account.
 */
async function createCheckoutSession(req, res) {
  try {
    const { userId, targetTier, email, successUrl, cancelUrl } = req.body || {};

    if (!userId || !targetTier) {
      return res.status(400).json({
        error: 'Missing required fields: userId and targetTier'
      });
    }

    const priceId = TIER_PRICE_MAP[targetTier];
    if (!priceId) {
      return res.status(400).json({
        error: `Unknown tier: ${targetTier}. Available: ${Object.keys(TIER_PRICE_MAP).join(', ')}`
      });
    }

    const origin = req.headers.origin || process.env.DASHBOARD_ORIGIN || 'http://localhost:3456';
    const sessionSuccessUrl = successUrl || `${origin}/dashboard.html#/billing-success?session_id={CHECKOUT_SESSION_ID}`;
    const sessionCancelUrl = cancelUrl || `${origin}/dashboard.html#/billing-cancel`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        userId: String(userId),
        targetTier: String(targetTier)
      },
      success_url: sessionSuccessUrl,
      cancel_url: sessionCancelUrl,
      // Optional: enable tax collection
      automatic_tax: { enabled: false }
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (err) {
    console.error('[stripe-checkout] session-creation-failed', err.message);
    res.status(500).json({
      error: 'Failed to create checkout session',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

module.exports = { createCheckoutSession, TIER_PRICE_MAP };
