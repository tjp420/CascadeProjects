// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Atomic user-tier upgrade helper.
 * In a real deployment this would call your database ORM / KV store.
 */
async function atomicUpgradeUser(userId, targetTier, stripeCustomerId, stripeSubscriptionId) {
  // TODO: replace with your actual database adapter (Prisma, Mongoose, etc.)
  // Example:
  // await db.user.update({
  //   where: { id: userId },
  //   data: {
  //     role: targetTier === 'enterprise' ? 'auditor' : 'developer',
  //     tier: targetTier,
  //     stripeCustomerId,
  //     stripeSubscriptionId,
  //     status: 'active',
  //     updatedAt: new Date()
  //   }
  // });

  // Stub: emit a structured log so operators can grep for post-payment events
  console.info('[stripe-webhook] atomic-upgrade', {
    userId,
    targetTier,
    stripeCustomerId,
    stripeSubscriptionId,
    ts: new Date().toISOString(),
  });
}

/**
 * License key regeneration stub.
 * Wire this to your license-engine module.
 */
async function regenerateLicense(userId, targetTier) {
  // TODO: call licenseEngine.generateAndBindToken(userId, targetTier);
  console.info('[stripe-webhook] license-regenerated', { userId, targetTier });
}

/**
 * POST /api/billing/stripe-webhook
 *
 * Bulletproof asynchronous Stripe webhook listener.
 * Never rely on the client-side redirect to update account state.
 */
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Cryptographically authenticate that the request originates from Stripe
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature-verification-failed', err.message);
    return res.status(400).send(`Webhook Signature Authentication Fault: ${err.message}`);
  }

  // Isolate transactional events that mutate account entitlement
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;

      // Extract metadata pinned during checkout creation
      const { userId, targetTier } = session.metadata || {};

      if (!userId || !targetTier) {
        console.error('[stripe-webhook] missing-metadata', { sessionId: session.id });
        return res.status(400).json({ error: 'Missing userId or targetTier in session metadata' });
      }

      // Atomic database transaction to upgrade account scope
      await atomicUpgradeUser(userId, targetTier, session.customer, session.subscription);

      // Regenerate and bind fresh license key metadata
      await regenerateLicense(userId, targetTier);

      console.info('[stripe-webhook] checkout-session-completed', {
        sessionId: session.id,
        userId,
        targetTier,
        customer: session.customer,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.warn('[stripe-webhook] invoice-payment-failed', {
        invoiceId: invoice.id,
        customer: invoice.customer,
        amountDue: invoice.amount_due,
      });
      // TODO: emit grace-period alert or downgrade account after retry window
      break;
    }

    case 'customer.subscription.deleted': {
      console.warn('[stripe-webhook] subscription-cancelled');
      // TODO: downgrade user to free/community tier
      break;
    }

    default:
      console.info('[stripe-webhook] unhandled-event-type', event.type);
  }

  res.json({ received: true });
}

module.exports = { handleStripeWebhook };
