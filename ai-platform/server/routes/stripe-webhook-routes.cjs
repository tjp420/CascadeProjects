// simplebeacon-ignore: debugArtifacts
/**
 * Stripe Webhook Routes — payment confirmation + subscription activation.
 *
 * POST /stripe/webhook  — receives Stripe webhook events, verifies signature,
 *                         activates subscriptions, sends confirmation email.
 *
 * Security: uses raw body for signature verification (not parsed JSON).
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, RESEND_FROM
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/app-logger.cjs');
const { getTierConfigByPriceId } = require('../config/stripe.cjs');
const { setSubscriptionActive, getSubscriptionByEmail, upsertSubscription, readStore } = require('../lib/simplebeacon-subscription-store.cjs');
const { sendEmail } = require('../lib/email-service.cjs');
const { sendPurchaseAlert } = require('../lib/purchase-alerts.cjs');
const { recordProcessedEvent } = require('../lib/stripe-event-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

// Use raw body for Stripe signature verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET not configured');
    return sendError(res, 503, 'stripe_not_configured');
  }

  if (!signature) {
    return sendError(res, 400, 'missing_signature');
  }

  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    return sendError(res, 400, 'missing_body');
  }

  // Verify webhook signature
  let event;
  try {
    event = verifyStripeSignature(req.body, signature, webhookSecret);
  } catch (err) {
    logger.error('[StripeWebhook] Signature verification failed:', err.message);
    return sendError(res, 400, 'invalid_signature');
  }

  logger.info('[StripeWebhook] Received event:', event.type, event.id);

  // Idempotency guard — prevent double-processing on Stripe retries
  const isFirstSeen = await recordProcessedEvent(event.id);
  if (!isFirstSeen) {
    logger.warn('[StripeWebhook] Duplicate event ignored:', event.id);
    return res.status(200).json({ received: true, status: 'duplicate_ignored', eventId: event.id });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, {
          licenseToken: req.headers['x-license-token'] || '',
          licenseTier: req.headers['x-license-tier'] || ''
        });
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event);
        break;
      default:
        logger.info('[StripeWebhook] Unhandled event type:', event.type);
        return res.json({ received: true, ignored: true, type: event.type });
    }
  } catch (err) {
    logger.error('[StripeWebhook] Event handler failed for', event.type, ':', err.message);
    return sendError(res, 500, 'handler_failed', { type: event.type });
  }

  res.json({ received: true, type: event.type });
});

/**
 * Verify Stripe webhook signature using HMAC-SHA256.
 * @param {Buffer} payload - Raw request body.
 * @param {string} signatureHeader - Stripe-Signature header value.
 * @param {string} secret - Webhook signing secret.
 * @returns {Object} Parsed event object.
 */
function verifyStripeSignature(payload, signatureHeader, secret) {
  const parts = {};
  for (const part of signatureHeader.split(',')) {
    const [key, ...valueParts] = part.split('=');
    parts[key.trim()] = valueParts.join('=').trim();
  }

  const timestamp = parts['t'];
  const v1Signature = parts['v1'];

  if (!timestamp || !v1Signature) {
    throw new Error('Missing timestamp or signature in header');
  }

  // Prevent replay attacks (5 minute tolerance)
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (ageSeconds > 300) {
    throw new Error('Webhook timestamp too old');
  }

  const signedPayload = `${timestamp}.${payload.toString('utf8')}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const expectedSigBuf = Buffer.from(expectedSignature);
  const receivedSigBuf = Buffer.from(v1Signature);
  if (expectedSigBuf.length !== receivedSigBuf.length) {
    throw new Error('Signature length mismatch');
  }
  if (!crypto.timingSafeEqual(expectedSigBuf, receivedSigBuf)) {
    throw new Error('Signature mismatch');
  }

  return JSON.parse(payload.toString('utf8'));
}

/**
 * Handle checkout.session.completed — activate subscription and send email.
 * @param {Object} event - Stripe event object.
 * @param {Object} [headers] - Extra headers from the Worker (license token, tier).
 */
async function handleCheckoutCompleted(event, headers = {}) {
  const session = event.data?.object;
  if (!session) {
    logger.warn('[StripeWebhook] checkout.session.completed: no session object');
    return;
  }

  const customerEmail = session.customer_details?.email || session.customer_email;
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const priceId = session.metadata?.price_id || extractPriceIdFromSession(session);
  const extraSeatsRaw = session.metadata?.extraSeats || session.metadata?.extra_seats || '0';
  const extraSeatsCount = Math.max(0, Math.min(50, parseInt(extraSeatsRaw, 10) || 0));

  if (!customerEmail) {
    logger.warn('[StripeWebhook] checkout.session.completed: no customer email in session', session.id);
    return;
  }

  // Resolve tier from price ID
  const tierConfig = priceId ? getTierConfigByPriceId(priceId) : null;
  const tier = tierConfig?.tier || 'pro';

  logger.info('[StripeWebhook] Activating subscription for', customerEmail, 'tier:', tier, 'extraSeats:', extraSeatsCount);

  // Activate subscription in store
  // Team Pro base includes 5 seats; extraSeats adds beyond that.
  const baseSeats = tier === 'team_pro' ? 5 : 1;
  const totalSeats = tier === 'team_pro' ? baseSeats + extraSeatsCount : 1;

  await setSubscriptionActive(customerEmail, true, {
    tier,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    periodStart: new Date().toISOString(),
    seatCount: totalSeats,
    extraSeats: extraSeatsCount
  });

  // Build email content — include license token if provided by the Worker
  const licenseToken = headers.licenseToken || '';
  const licenseTier = headers.licenseTier || tier;

  const seatSummary = extraSeatsCount > 0
    ? `\n\nYour Team Pro subscription includes 5 base seats plus ${extraSeatsCount} extra seat${extraSeatsCount === 1 ? '' : 's'} (${totalSeats} total).`
    : (tier === 'team_pro' ? '\n\nYour Team Pro subscription includes 5 seats.' : '');

  let emailText = `Your SimpleBeacon ${tier} subscription is now active.\n\nYou can start using all ${tier} tier features immediately.${seatSummary}\n\nThank you for your purchase.`;
  let emailHtml = `<h2>Subscription Activated</h2><p>Your SimpleBeacon <strong>${tier}</strong> subscription is now active.</p><p>You can start using all ${tier} tier features immediately.</p>${extraSeatsCount > 0 ? `<p>Your Team Pro subscription includes 5 base seats plus <strong>${extraSeatsCount} extra seat${extraSeatsCount === 1 ? '' : 's'}</strong> (${totalSeats} total).</p>` : (tier === 'team_pro' ? '<p>Your Team Pro subscription includes 5 seats.</p>' : '')}<p>Thank you for your purchase.</p>`;

  if (licenseToken) {
    emailText += `\n\n--- Your License Key ---\n${licenseToken}\n------------------------\n\nKeep this key safe. You can use it to activate SimpleBeacon in your editor or CLI.\n\nYou can also retrieve it anytime from your dashboard: https://simplebeacon.ai`;
    emailHtml += `<hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"><h3>Your License Key</h3><div style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;font-size:12px;word-break:break-all;border:1px solid #e5e7eb">${licenseToken}</div><p style="margin-top:10px;color:#6b7280;font-size:13px">Keep this key safe. You can use it to activate SimpleBeacon in your editor or CLI.<br>You can also retrieve it anytime from your <a href="https://simplebeacon.ai">dashboard</a>.</p>`;
  }

  // Send confirmation email via Resend (with disk queue fallback)
  const emailResult = await sendEmail({
    to: customerEmail,
    subject: 'SimpleBeacon Subscription Activated',
    text: emailText,
    html: emailHtml
  });

  logger.info('[StripeWebhook] Confirmation email result:', emailResult.sent ? 'sent' : 'queued', 'for', customerEmail, 'token included:', !!licenseToken);

  // Send Slack/Discord purchase notification (no-op if PURCHASE_ALERT_WEBHOOK not set)
  var alertAmount = session.amount_total || (tierConfig ? tierConfig.basePrice : null);
  var alertResult = await sendPurchaseAlert({
    tier: tier,
    email: customerEmail,
    priceId: priceId,
    amount: alertAmount,
    customerId: customerId,
    extraSeats: extraSeatsCount,
    totalSeats: totalSeats
  });
  if (alertResult.sent) {
    logger.info('[StripeWebhook] Purchase alert sent to', alertResult.platform, 'for tier:', tier);
  }
}

/**
 * Look up a subscription by Stripe customer ID.
 * @param {string} customerId - Stripe customer ID.
 * @returns {Promise<SubscriptionRecord|null>}
 */
async function findSubscriptionByCustomerId(customerId) {
  if (!customerId) return null;
  const store = await readStore();
  for (const email of Object.keys(store.subscriptions)) {
    const record = store.subscriptions[email];
    if (record.stripeCustomerId === customerId) {
      return record;
    }
  }
  return null;
}

/**
 * Handle customer.subscription.updated — update tier if changed.
 * @param {Object} event - Stripe event object.
 */
async function handleSubscriptionUpdated(event) {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const tierConfig = priceId ? getTierConfigByPriceId(priceId) : null;

  if (!tierConfig) {
    logger.info('[StripeWebhook] subscription.updated: no tier mapping for price', priceId);
    return;
  }

  logger.info('[StripeWebhook] subscription.updated: tier', tierConfig.tier, 'for customer', customerId);

  // Look up existing subscription by stripeCustomerId to get the email
  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn('[StripeWebhook] subscription.updated: no existing subscription for customer', customerId);
    return;
  }

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : new Date().toISOString();

  await setSubscriptionActive(existing.email, subscription.status === 'active', {
    tier: tierConfig.tier,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    periodStart
  });

  logger.info('[StripeWebhook] subscription.updated: store updated for', existing.email, 'tier:', tierConfig.tier, 'active:', subscription.status === 'active');
}

/**
 * Handle customer.subscription.deleted — deactivate subscription.
 * @param {Object} event - Stripe event object.
 */
async function handleSubscriptionDeleted(event) {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;
  logger.info('[StripeWebhook] subscription.deleted for customer', customerId);

  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn('[StripeWebhook] subscription.deleted: no existing subscription for customer', customerId);
    return;
  }

  await setSubscriptionActive(existing.email, false, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id
  });

  logger.info('[StripeWebhook] subscription.deleted: deactivated for', existing.email);

  try {
    await sendEmail({
      to: existing.email,
      subject: 'SimpleBeacon Subscription Canceled',
      text: 'Your SimpleBeacon subscription has been canceled.\n\nYou will retain access until the end of your current billing period. After that, your account will revert to the free tier.\n\nWe hope to see you again soon.',
      html: '<h2>Subscription Canceled</h2><p>Your SimpleBeacon subscription has been canceled.</p><p>You will retain access until the end of your current billing period. After that, your account will revert to the free tier.</p><p>We hope to see you again soon.</p>'
    });
    logger.info('[StripeWebhook] Cancellation email sent to', existing.email);
  } catch (emailErr) {
    logger.error('[StripeWebhook] Cancellation email failed:', emailErr.message);
  }
}

/**
 * Handle invoice.paid — re-activate subscription if it was suspended.
 * Stripe sends this event when a retry succeeds after a failed payment.
 * @param {Object} event - Stripe event object.
 */
async function handleInvoicePaid(event) {
  const invoice = event.data?.object;
  if (!invoice) return;

  // Only handle invoices for subscription payments (not one-time charges)
  if (!invoice.subscription) return;

  const customerEmail = invoice.customer_email || invoice.customer_details?.email;
  if (!customerEmail) {
    logger.warn('[StripeWebhook] invoice.paid: no customer email on invoice', invoice.id);
    return;
  }

  // Check current subscription state
  const existing = await getSubscriptionByEmail(customerEmail);
  if (!existing) {
    logger.info('[StripeWebhook] invoice.paid: no existing subscription for', customerEmail, '— skipping');
    return;
  }

  // Only re-activate if currently inactive (failed payment recovery)
  if (existing.subscriptionActive) {
    logger.info('[StripeWebhook] invoice.paid: subscription already active for', customerEmail, '— no action needed');
    return;
  }

  logger.info('[StripeWebhook] invoice.paid: re-activating suspended subscription for', customerEmail);

  await setSubscriptionActive(customerEmail, true, {
    periodStart: new Date().toISOString()
  });

  const emailResult = await sendEmail({
    to: customerEmail,
    subject: 'SimpleBeacon Subscription Reactivated',
    text: `Your SimpleBeacon subscription has been reactivated following successful payment.\n\nAll features are restored. Thank you for your continued subscription.`,
    html: `<h2>Subscription Reactivated</h2><p>Your SimpleBeacon subscription has been reactivated following successful payment.</p><p>All features are restored. Thank you for your continued subscription.</p>`
  });

  logger.info('[StripeWebhook] Reactivation email result:', emailResult.sent ? 'sent' : 'queued', 'for', customerEmail);
}

/**
 * Extract price ID from checkout session (fallback when not in metadata).
 * @param {Object} session - Stripe checkout session.
 * @returns {string|null}
 */
function extractPriceIdFromSession(session) {
  // Try to get from line items or subscription details
  if (session.subscription_details?.price_id) {
    return session.subscription_details.price_id;
  }
  return null;
}

module.exports = router;
