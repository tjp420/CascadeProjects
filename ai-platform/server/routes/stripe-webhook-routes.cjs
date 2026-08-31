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

const express = require("express");
const crypto = require("crypto");
const logger = require("../lib/app-logger.cjs");
const { getTierConfigByPriceId } = require("../config/stripe.cjs");
const {
  setSubscriptionActive,
  getSubscriptionByEmail,
  upsertSubscription,
  readStore,
} = require("../lib/simplebeacon-subscription-store.cjs");
const { sendEmail } = require("../lib/email-service.cjs");
const { sendPurchaseAlert } = require("../lib/purchase-alerts.cjs");
const { recordProcessedEvent } = require("../lib/stripe-event-store.cjs");
const { logWebhookEvent } = require("../lib/webhook-event-log.cjs");
const {
  renderSubscriptionActivated,
  renderSubscriptionCanceled,
  renderSubscriptionReactivated,
  renderPaymentFailed,
  renderTrialEnding,
  renderDisputeAlert,
  renderInvoiceUpcoming,
  renderProrationNotice,
  renderSubscriptionPaused,
  renderSubscriptionResumed,
} = require("../lib/billing-email-templates.cjs");
const { calculateProration } = require("../lib/proration-calculator.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

// Onboarding drip — register new activations for the drip email sequence
let onboardingDripStore = null;
try {
  onboardingDripStore = require("../lib/onboarding-drip-store.cjs");
} catch (e) {
  logger.warn("[StripeWebhook] onboarding-drip-store not loaded:", e.message);
}

// Session token store — shared with coming-soon checkout and ai-platform billing API
// so the dashboard can retrieve the license token after Stripe checkout redirect.
let sessionTokenStore = null;
try {
  sessionTokenStore = require("../../../coming-soon/routes/session-token-store.cjs");
} catch (e) {
  logger.warn("[StripeWebhook] session-token-store not loaded:", e.message);
}

const router = express.Router();

// Use raw body for Stripe signature verification
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error("[StripeWebhook] STRIPE_WEBHOOK_SECRET not configured");
      return sendError(res, 503, "stripe_not_configured");
    }

    if (!signature) {
      return sendError(res, 400, "missing_signature");
    }

    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      return sendError(res, 400, "missing_body");
    }

    // Verify webhook signature
    let event;
    try {
      event = verifyStripeSignature(req.body, signature, webhookSecret);
    } catch (err) {
      logger.error(
        "[StripeWebhook] Signature verification failed:",
        err.message,
      );
      return sendError(res, 400, "invalid_signature");
    }

    logger.info("[StripeWebhook] Received event:", event.type, event.id);

    // Idempotency guard — prevent double-processing on Stripe retries
    const isFirstSeen = await recordProcessedEvent(event.id);
    if (!isFirstSeen) {
      logger.warn("[StripeWebhook] Duplicate event ignored:", event.id);
      await logWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        status: "duplicate",
      });
      return res
        .status(200)
        .json({
          received: true,
          status: "duplicate_ignored",
          eventId: event.id,
        });
    }

    let logStatus = "processed";
    let logEmail = null;
    let logTier = null;
    let logAmount = null;
    let logReason = null;
    let logDetail = null;
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const result = await handleCheckoutCompleted(event, {
            licenseToken: req.headers["x-license-token"] || "",
            licenseTier: req.headers["x-license-tier"] || "",
          });
          const session = event.data?.object;
          logEmail =
            session?.customer_details?.email || session?.customer_email || null;
          logAmount = session?.amount_total
            ? `$${(session.amount_total / 100).toFixed(2)}`
            : null;
          logDetail = "Subscription activated";
          break;
        }
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event);
          logDetail = "Subscription updated";
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event);
          logDetail = "Subscription canceled";
          break;
        case "invoice.paid":
          await handleInvoicePaid(event);
          logDetail = "Payment succeeded";
          break;
        case "invoice.payment_failed": {
          const inv = event.data?.object;
          logEmail =
            inv?.customer_email || inv?.customer_details?.email || null;
          logReason = inv ? `attempt ${inv.attempt_count || 1}` : null;
          logDetail = "Payment failed";
          await handleInvoicePaymentFailed(event);
          break;
        }
        case "customer.subscription.trial_will_end":
          await handleTrialWillEnd(event);
          logDetail = "Trial ending soon";
          break;
        case "charge.dispute.created": {
          const dispute = event.data?.object;
          logReason = dispute?.reason || null;
          logAmount = dispute?.amount
            ? `$${(dispute.amount / 100).toFixed(2)} ${dispute.currency || "usd".toUpperCase()}`
            : null;
          logDetail = "Dispute filed";
          await handleDisputeCreated(event);
          break;
        }
        case "invoice.upcoming": {
          const inv = event.data?.object;
          logEmail =
            inv?.customer_email || inv?.customer_details?.email || null;
          logAmount = inv?.amount_due
            ? `$${(inv.amount_due / 100).toFixed(2)}`
            : null;
          logDetail = "Invoice coming due";
          await handleInvoiceUpcoming(event);
          break;
        }
        case "customer.subscription.paused": {
          const sub = event.data?.object;
          logDetail = "Subscription paused";
          await handleSubscriptionPaused(event);
          break;
        }
        case "customer.subscription.resumed": {
          const sub = event.data?.object;
          logDetail = "Subscription resumed";
          await handleSubscriptionResumed(event);
          break;
        }
        default:
          logger.info("[StripeWebhook] Unhandled event type:", event.type);
          logStatus = "ignored";
          await logWebhookEvent({
            eventId: event.id,
            eventType: event.type,
            status: "ignored",
          });
          return res.json({ received: true, ignored: true, type: event.type });
      }
    } catch (err) {
      logger.error(
        "[StripeWebhook] Event handler failed for",
        event.type,
        ":",
        err.message,
      );
      logStatus = "error";
      logDetail = err.message;
      await logWebhookEvent({
        eventId: event.id,
        eventType: event.type,
        status: "error",
        customerEmail: logEmail,
        detail: logDetail,
      });
      return sendError(res, 500, "handler_failed", { type: event.type });
    }

    await logWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      status: logStatus,
      customerEmail: logEmail,
      tier: logTier,
      amount: logAmount,
      reason: logReason,
      detail: logDetail,
    });
    res.json({ received: true, type: event.type });
  },
);

/**
 * Verify Stripe webhook signature using HMAC-SHA256.
 * @param {Buffer} payload - Raw request body.
 * @param {string} signatureHeader - Stripe-Signature header value.
 * @param {string} secret - Webhook signing secret.
 * @returns {Object} Parsed event object.
 */
function verifyStripeSignature(payload, signatureHeader, secret) {
  const parts = {};
  for (const part of signatureHeader.split(",")) {
    const [key, ...valueParts] = part.split("=");
    parts[key.trim()] = valueParts.join("=").trim();
  }

  const timestamp = parts["t"];
  const v1Signature = parts["v1"];

  if (!timestamp || !v1Signature) {
    throw new Error("Missing timestamp or signature in header");
  }

  // Prevent replay attacks (5 minute tolerance)
  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (ageSeconds > 300) {
    throw new Error("Webhook timestamp too old");
  }

  const signedPayload = `${timestamp}.${payload.toString("utf8")}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const expectedSigBuf = Buffer.from(expectedSignature);
  const receivedSigBuf = Buffer.from(v1Signature);
  if (expectedSigBuf.length !== receivedSigBuf.length) {
    throw new Error("Signature length mismatch");
  }
  if (!crypto.timingSafeEqual(expectedSigBuf, receivedSigBuf)) {
    throw new Error("Signature mismatch");
  }

  return JSON.parse(payload.toString("utf8"));
}

/**
 * Handle checkout.session.completed — activate subscription and send email.
 * @param {Object} event - Stripe event object.
 * @param {Object} [headers] - Extra headers from the Worker (license token, tier).
 */
async function handleCheckoutCompleted(event, headers = {}) {
  const session = event.data?.object;
  if (!session) {
    logger.warn(
      "[StripeWebhook] checkout.session.completed: no session object",
    );
    return;
  }

  const customerEmail =
    session.customer_details?.email || session.customer_email;
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const priceId =
    session.metadata?.price_id || extractPriceIdFromSession(session);
  const extraSeatsRaw =
    session.metadata?.extraSeats || session.metadata?.extra_seats || "0";
  const extraSeatsCount = Math.max(
    0,
    Math.min(50, parseInt(extraSeatsRaw, 10) || 0),
  );

  if (!customerEmail) {
    logger.warn(
      "[StripeWebhook] checkout.session.completed: no customer email in session",
      session.id,
    );
    return;
  }

  // Resolve tier — try price ID first, then fall back to metadata.product
  // (set by the coming-soon checkout as the tier key, e.g. "developer" or "team_pro").
  // Ad-hoc price_data checkout sessions don't have a Stripe Price ID, so
  // metadata.product is the reliable tier source.
  const tierConfig = priceId ? getTierConfigByPriceId(priceId) : null;
  const metadataProduct = String(session.metadata?.product || "").toLowerCase();
  const tier = tierConfig?.tier || metadataProduct || "developer";

  logger.info(
    "[StripeWebhook] Activating subscription for",
    customerEmail,
    "tier:",
    tier,
    "extraSeats:",
    extraSeatsCount,
    "priceId:",
    priceId || "(none)",
    "metadataProduct:",
    metadataProduct || "(none)",
  );

  // Activate subscription in store
  // Team Pro base includes 5 seats; extraSeats adds beyond that.
  const baseSeats = tier === "team_pro" ? 5 : 1;
  const totalSeats = tier === "team_pro" ? baseSeats + extraSeatsCount : 1;

  await setSubscriptionActive(customerEmail, true, {
    tier,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    periodStart: new Date().toISOString(),
    seatCount: totalSeats,
    extraSeats: extraSeatsCount,
  });

  // Mint a license token on the backend using the correct signing secret.
  // The Worker no longer mints tokens — it's a pure proxy. This ensures
  // the token is signed with SIMPLEBEACON_LICENSE_SECRET (the same secret
  // used by verifyLicenseToken in auth-inline-routes and the CLI).
  let licenseToken = headers.licenseToken || "";
  if (!licenseToken) {
    try {
      const { generateLicenseToken } = require("../../../packages/simplebeacon-cli/src/lib/license-token.js");
      const licenseSecret = process.env.SIMPLEBEACON_LICENSE_SECRET;
      if (licenseSecret) {
        // Determine TTL from tier config (expiryDays) or default to 30 days
        const expiryDays = tierConfig?.expiryDays || 30;
        const ttlMinutes = expiryDays * 24 * 60;
        const features =
          tier === "team_pro" || tier === "enterprise"
            ? [
                "continuous_shield",
                "team_dashboard",
                "ci_integration",
                "compliance_certificate",
                "eu_ai_act",
                "analyst_support",
                "premium_exports",
              ]
            : ["continuous_shield", "ci_integration", "export_reports", "premium_exports"];
        const tokenPayload = {
          email: customerEmail,
          tier,
          projectName: session.metadata?.projectName || customerEmail,
          clientName: session.metadata?.clientName || customerEmail,
          features,
        };
        licenseToken = generateLicenseToken(tokenPayload, licenseSecret, ttlMinutes);
        logger.info(
          "[StripeWebhook] Minted license token on backend for",
          customerEmail,
          "tier:",
          tier,
          "TTL:",
          expiryDays + " days",
        );
      } else {
        logger.warn(
          "[StripeWebhook] SIMPLEBEACON_LICENSE_SECRET not configured — cannot mint token",
        );
      }
    } catch (mintErr) {
      logger.error(
        "[StripeWebhook] License token minting failed:",
        mintErr.message,
      );
    }
  }

  // Store license token in session-token store so the post-checkout redirect
  // can retrieve it via GET /api/session-token/:sessionId on the ai-platform server.
  if (licenseToken && sessionTokenStore && session.id) {
    try {
      sessionTokenStore.set(session.id, {
        token: licenseToken,
        email: customerEmail,
        projectName: session.metadata?.projectName || "default-project",
        tier,
      });
      logger.info(
        "[StripeWebhook] Stored license token in session-token store for session",
        session.id,
      );
    } catch (storeErr) {
      logger.warn(
        "[StripeWebhook] Failed to store token in session-token store:",
        storeErr.message,
      );
    }
  }

  // Build email content using centralized template
  const { subject, text, html } = renderSubscriptionActivated({
    tier,
    licenseToken,
    totalSeats,
    extraSeats: extraSeatsCount,
  });

  // Send confirmation email via Resend (with disk queue fallback)
  const emailResult = await sendEmail({
    to: customerEmail,
    subject,
    text,
    html,
  });

  logger.info(
    "[StripeWebhook] Confirmation email result:",
    emailResult.sent ? "sent" : "queued",
    "for",
    customerEmail,
    "token included:",
    !!licenseToken,
  );

  // Register the activation in the onboarding drip store so the cron job
  // can send day 1, day 3, and day 7 follow-up emails.
  if (onboardingDripStore) {
    try {
      onboardingDripStore.registerActivation(customerEmail, tier);
    } catch (dripErr) {
      logger.warn(
        "[StripeWebhook] Failed to register onboarding drip:",
        dripErr?.message || dripErr,
      );
    }
  }

  // Send Slack/Discord purchase notification (no-op if PURCHASE_ALERT_WEBHOOK not set)
  var alertAmount =
    session.amount_total || (tierConfig ? tierConfig.basePrice : null);
  var alertResult = await sendPurchaseAlert({
    tier: tier,
    email: customerEmail,
    priceId: priceId,
    amount: alertAmount,
    customerId: customerId,
    extraSeats: extraSeatsCount,
    totalSeats: totalSeats,
  });
  if (alertResult.sent) {
    logger.info(
      "[StripeWebhook] Purchase alert sent to",
      alertResult.platform,
      "for tier:",
      tier,
    );
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
    logger.info(
      "[StripeWebhook] subscription.updated: no tier mapping for price",
      priceId,
    );
    return;
  }

  logger.info(
    "[StripeWebhook] subscription.updated: tier",
    tierConfig.tier,
    "for customer",
    customerId,
  );

  // Look up existing subscription by stripeCustomerId to get the email
  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn(
      "[StripeWebhook] subscription.updated: no existing subscription for customer",
      customerId,
    );
    return;
  }

  // Detect tier change for proration notification
  const oldTier = existing.tier;
  const newTier = tierConfig.tier;
  const tierChanged = oldTier && oldTier !== newTier;

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : new Date().toISOString();

  await setSubscriptionActive(
    existing.email,
    subscription.status === "active",
    {
      tier: newTier,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      periodStart,
    },
  );

  logger.info(
    "[StripeWebhook] subscription.updated: store updated for",
    existing.email,
    "tier:",
    newTier,
    "active:",
    subscription.status === "active",
  );

  // Send proration notice email if tier changed
  if (tierChanged) {
    const isAnnual =
      tierConfig.product && tierConfig.product.includes("annual");
    const proration = calculateProration({
      fromTier: oldTier,
      toTier: newTier,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
      isAnnual,
    });

    logger.info(
      "[StripeWebhook] Tier change detected for",
      existing.email,
      ":",
      oldTier,
      "→",
      newTier,
      "proration:",
      proration.netAdjustmentDisplay,
    );

    try {
      const { subject, text, html } = renderProrationNotice({
        fromTier: oldTier,
        toTier: newTier,
        isUpgrade: proration.isUpgrade,
        daysRemaining: proration.daysRemaining,
        netAdjustmentCents: proration.netAdjustmentCents,
        netAdjustmentDisplay: proration.netAdjustmentDisplay,
        isAnnual,
      });
      const emailResult = await sendEmail({
        to: existing.email,
        subject,
        text,
        html,
      });
      logger.info(
        "[StripeWebhook] Proration notice email",
        emailResult.sent ? "sent" : "queued",
        "for",
        existing.email,
      );
    } catch (emailErr) {
      logger.error(
        "[StripeWebhook] Proration notice email failed:",
        emailErr.message,
      );
    }
  }
}

/**
 * Handle customer.subscription.deleted — deactivate subscription.
 * @param {Object} event - Stripe event object.
 */
async function handleSubscriptionDeleted(event) {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;
  logger.info("[StripeWebhook] subscription.deleted for customer", customerId);

  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn(
      "[StripeWebhook] subscription.deleted: no existing subscription for customer",
      customerId,
    );
    return;
  }

  await setSubscriptionActive(existing.email, false, {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  });

  logger.info(
    "[StripeWebhook] subscription.deleted: deactivated for",
    existing.email,
  );

  try {
    const { subject, text, html } = renderSubscriptionCanceled();
    await sendEmail({ to: existing.email, subject, text, html });
    logger.info("[StripeWebhook] Cancellation email sent to", existing.email);
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Cancellation email failed:",
      emailErr.message,
    );
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

  const customerEmail =
    invoice.customer_email || invoice.customer_details?.email;
  if (!customerEmail) {
    logger.warn(
      "[StripeWebhook] invoice.paid: no customer email on invoice",
      invoice.id,
    );
    return;
  }

  // Check current subscription state
  const existing = await getSubscriptionByEmail(customerEmail);
  if (!existing) {
    logger.info(
      "[StripeWebhook] invoice.paid: no existing subscription for",
      customerEmail,
      "— skipping",
    );
    return;
  }

  // Only re-activate if currently inactive (failed payment recovery)
  if (existing.subscriptionActive) {
    logger.info(
      "[StripeWebhook] invoice.paid: subscription already active for",
      customerEmail,
      "— no action needed",
    );
    return;
  }

  logger.info(
    "[StripeWebhook] invoice.paid: re-activating suspended subscription for",
    customerEmail,
  );

  await setSubscriptionActive(customerEmail, true, {
    periodStart: new Date().toISOString(),
  });

  const { subject, text, html } = renderSubscriptionReactivated();
  const emailResult = await sendEmail({
    to: customerEmail,
    subject,
    text,
    html,
  });

  logger.info(
    "[StripeWebhook] Reactivation email result:",
    emailResult.sent ? "sent" : "queued",
    "for",
    customerEmail,
  );
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

/**
 * Handle invoice.payment_failed — mark subscription past_due, notify customer.
 * Stripe sends this when a renewal payment fails. The subscription enters
 * a grace period (past_due) before being deactivated after retry exhaustion.
 * @param {Object} event - Stripe event object.
 */
async function handleInvoicePaymentFailed(event) {
  const invoice = event.data?.object;
  if (!invoice) return;

  if (!invoice.subscription) return;

  const customerEmail =
    invoice.customer_email || invoice.customer_details?.email;
  if (!customerEmail) {
    logger.warn(
      "[StripeWebhook] invoice.payment_failed: no customer email on invoice",
      invoice.id,
    );
    return;
  }

  const attemptCount = invoice.attempt_count || 1;
  const nextRetry = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000).toISOString()
    : null;

  logger.warn(
    "[StripeWebhook] Payment FAILED for",
    customerEmail,
    "invoice:",
    invoice.id,
    "attempt:",
    attemptCount,
    "nextRetry:",
    nextRetry || "none",
  );

  const existing = await getSubscriptionByEmail(customerEmail);
  if (!existing) {
    logger.info(
      "[StripeWebhook] invoice.payment_failed: no existing subscription for",
      customerEmail,
    );
    return;
  }

  await setSubscriptionActive(customerEmail, false, {
    stripeCustomerId: invoice.customer,
    stripeSubscriptionId: invoice.subscription,
    paymentStatus: "past_due",
    lastPaymentFailure: new Date().toISOString(),
    retryAttempt: attemptCount,
  });

  logger.info(
    "[StripeWebhook] Subscription marked past_due for",
    customerEmail,
    "attempt:",
    attemptCount,
  );

  try {
    const { subject, text, html } = renderPaymentFailed({
      attemptCount,
      nextRetry,
    });
    const emailResult = await sendEmail({
      to: customerEmail,
      subject,
      text,
      html,
    });
    logger.info(
      "[StripeWebhook] Payment failure email",
      emailResult.sent ? "sent" : "queued",
      "for",
      customerEmail,
    );
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Payment failure email failed:",
      emailErr.message,
    );
  }
}

/**
 * Handle customer.subscription.trial_will_end — notify customer 3 days before trial ends.
 * Stripe sends this event 3 days before a trial period expires.
 * @param {Object} event - Stripe event object.
 */
async function handleTrialWillEnd(event) {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null;

  logger.info(
    "[StripeWebhook] trial_will_end for customer",
    customerId,
    "trial ends:",
    trialEnd,
  );

  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn(
      "[StripeWebhook] trial_will_end: no existing subscription for customer",
      customerId,
    );
    return;
  }

  try {
    const { subject, text, html } = renderTrialEnding({ trialEnd });
    const emailResult = await sendEmail({
      to: existing.email,
      subject,
      text,
      html,
    });
    logger.info(
      "[StripeWebhook] Trial ending email",
      emailResult.sent ? "sent" : "queued",
      "for",
      existing.email,
    );
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Trial ending email failed:",
      emailErr.message,
    );
  }
}

/**
 * Handle charge.dispute.created — log dispute, mark subscription for review.
 * Stripe sends this when a customer disputes a charge with their bank.
 * @param {Object} event - Stripe event object.
 */
async function handleDisputeCreated(event) {
  const dispute = event.data?.object;
  if (!dispute) return;

  const chargeId = dispute.charge;
  const reason = dispute.reason || "unspecified";
  const status = dispute.status || "needs_response";
  const amount = dispute.amount ? (dispute.amount / 100).toFixed(2) : "unknown";
  const currency = dispute.currency || "usd";

  logger.warn(
    "[StripeWebhook] Dispute CREATED — charge:",
    chargeId,
    "reason:",
    reason,
    "amount:",
    amount,
    currency.toUpperCase(),
    "status:",
    status,
  );

  const customerEmail =
    dispute.evidence_details?.customer_email ||
    (dispute.metadata && dispute.metadata.customer_email);

  if (customerEmail) {
    const existing = await getSubscriptionByEmail(customerEmail);
    if (existing) {
      await setSubscriptionActive(customerEmail, existing.subscriptionActive, {
        disputeStatus: status,
        disputeReason: reason,
        disputeChargeId: chargeId,
        disputeOpenedAt: new Date().toISOString(),
      });
      logger.warn(
        "[StripeWebhook] Dispute recorded for",
        customerEmail,
        "reason:",
        reason,
      );
    }
  }

  try {
    const { subject, text, html } = renderDisputeAlert({
      chargeId,
      reason,
      status,
      amountCents: dispute.amount,
      currency,
    });
    await sendEmail({
      to: process.env.DISPUTE_ALERT_EMAIL || "support@simplebeacon.ai",
      subject,
      text,
      html,
    });
    logger.info(
      "[StripeWebhook] Dispute alert email sent for charge",
      chargeId,
    );
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Dispute alert email failed:",
      emailErr.message,
    );
  }
}

/**
 * Handle invoice.upcoming — notify customer of an upcoming subscription charge.
 * Stripe sends this event a few days before a subscription renewal payment is collected.
 * @param {Object} event - Stripe event object.
 */
async function handleInvoiceUpcoming(event) {
  const invoice = event.data?.object;
  if (!invoice) return;

  if (!invoice.subscription) return;

  const customerEmail =
    invoice.customer_email || invoice.customer_details?.email;
  if (!customerEmail) {
    logger.warn(
      "[StripeWebhook] invoice.upcoming: no customer email on invoice",
      invoice.id,
    );
    return;
  }

  const amountCents = invoice.amount_due || invoice.total;
  const currency = invoice.currency || "usd";
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date * 1000).toISOString()
    : invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null;
  const invoiceNumber = invoice.number || invoice.id || null;

  const existing = await getSubscriptionByEmail(customerEmail);
  const tier = existing?.tier || "pro";

  logger.info(
    "[StripeWebhook] invoice.upcoming for",
    customerEmail,
    "amount:",
    amountCents,
    currency,
    "due:",
    dueDate,
  );

  try {
    const { subject, text, html } = renderInvoiceUpcoming({
      amountCents,
      currency,
      dueDate,
      tier,
      invoiceNumber,
    });
    const emailResult = await sendEmail({
      to: customerEmail,
      subject,
      text,
      html,
    });
    logger.info(
      "[StripeWebhook] Invoice upcoming email",
      emailResult.sent ? "sent" : "queued",
      "for",
      customerEmail,
    );
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Invoice upcoming email failed:",
      emailErr.message,
    );
  }
}

/**
 * Handle customer.subscription.paused — notify customer their subscription is paused.
 * @param {Object} event - Stripe event object.
 */
async function handleSubscriptionPaused(event) {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;
  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn(
      "[StripeWebhook] subscription.paused: no existing subscription for customer",
      customerId,
    );
    return;
  }

  const tier = existing.tier || "pro";
  const resumeDate = subscription.pause_collection?.resumes_at
    ? new Date(subscription.pause_collection.resumes_at * 1000).toISOString()
    : null;

  logger.info(
    "[StripeWebhook] subscription.paused for",
    existing.email,
    "tier:",
    tier,
    "resume:",
    resumeDate,
  );

  try {
    const { subject, text, html } = renderSubscriptionPaused({
      tier,
      resumeDate,
    });
    const emailResult = await sendEmail({
      to: existing.email,
      subject,
      text,
      html,
    });
    logger.info(
      "[StripeWebhook] Subscription paused email",
      emailResult.sent ? "sent" : "queued",
      "for",
      existing.email,
    );
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Subscription paused email failed:",
      emailErr.message,
    );
  }
}

/**
 * Handle customer.subscription.resumed — notify customer their subscription is active again.
 * @param {Object} event - Stripe event object.
 */
async function handleSubscriptionResumed(event) {
  const subscription = event.data?.object;
  if (!subscription) return;

  const customerId = subscription.customer;
  const existing = await findSubscriptionByCustomerId(customerId);
  if (!existing) {
    logger.warn(
      "[StripeWebhook] subscription.resumed: no existing subscription for customer",
      customerId,
    );
    return;
  }

  const tier = existing.tier || "pro";

  logger.info(
    "[StripeWebhook] subscription.resumed for",
    existing.email,
    "tier:",
    tier,
  );

  try {
    const { subject, text, html } = renderSubscriptionResumed({ tier });
    const emailResult = await sendEmail({
      to: existing.email,
      subject,
      text,
      html,
    });
    logger.info(
      "[StripeWebhook] Subscription resumed email",
      emailResult.sent ? "sent" : "queued",
      "for",
      existing.email,
    );
  } catch (emailErr) {
    logger.error(
      "[StripeWebhook] Subscription resumed email failed:",
      emailErr.message,
    );
  }
}

module.exports = router;
