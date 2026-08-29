"use strict";

/**
 * Refund webhook test — verifies that charge.refunded events are correctly
 * handled by the subscription webhook endpoint.
 *
 * This test stubs Stripe, the DB, and email services, then fires synthetic
 * webhook events at the local express app to verify:
 *   1. Full refunds mark the customer subscription as 'refunded'
 *   2. Partial refunds update the subscription without deactivating
 *   3. Refund email is sent via the billing email templates
 *   4. Unknown events are ignored gracefully
 *   5. Missing customer email logs a warning but does not crash
 */

const http = require("http");
const path = require("path");
const crypto = require("crypto");
const Module = require("module");
const express = require("express");

// Set env vars required by the webhook handler before requiring it
process.env.STRIPE_SECRET_KEY = "sk_test_123";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

// --- Stubs ---
const emailCallLog = [];
const dbCallLog = [];

const originalRequire = Module.prototype.require;

// Track which modules we've stubbed so we can restore
Module.prototype.require = function (id) {
  // Stub stripe — we need webhooks.constructEvent to return our synthetic event
  if (id === "stripe") {
    return function () {
      return {
        customers: { create: async () => ({ id: "cus_test_123" }) },
        checkout: {
          sessions: {
            create: async () => ({ id: "cs_test_123", url: "https://test/abc" }),
          },
        },
        webhooks: {
          constructEvent: (body, sig, secret) => {
            // Parse the body as JSON and return it as a synthetic event
            const parsed = JSON.parse(body.toString());
            return parsed;
          },
        },
        refunds: { create: async () => ({ id: "re_test_123" }) },
      };
    };
  }
  // Stub db
  if (id.includes("lib/db.cjs")) {
    return {
      getOrCreateCustomer: () => ({
        id: 1,
        email: "test@example.com",
        subscription_status: "active",
        stripe_customer_id: "cus_test_123",
        tier: "developer",
        api_key: "sb_test_key",
      }),
      updateCustomerSubscription: (email, status, tier) => {
        dbCallLog.push({ fn: "updateCustomerSubscription", email, status, tier });
      },
      updateCustomerStripeId: () => {},
      updatePaidSubscriptionStatus: () => {},
      addPaidSubscription: () => {},
      recordWebhookEvent: () => true, // always first-seen
      getDb: () => ({
        prepare: () => ({
          get: () => ({
            email: "test@example.com",
            tier: "developer",
            subscription_status: "active",
            stripe_customer_id: "cus_test_123",
            api_key: "sb_test_key",
          }),
          all: () => [{
            email: "test@example.com",
            tier: "developer",
            subscription_status: "active",
            stripe_customer_id: "cus_test_123",
            api_key: "sb_test_key",
          }],
        }),
      }),
    };
  }
  // Stub referral-webhook
  if (id.includes("referral-webhook")) {
    return {
      buildReferralCheckoutMetadata: () => ({}),
      processStripeReferralAttribution: () => ({ converted: false }),
    };
  }
  // Stub license-utils
  if (id.includes("license-utils")) {
    return {
      generateLicenseToken: () => "test-token-123",
      escapeHtml: (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
    };
  }
  // Stub email service — log calls so we can assert
  if (id.includes("services/email")) {
    return {
      sendEmail: async (opts) => {
        emailCallLog.push(opts);
        return { sent: true, queued: false };
      },
    };
  }
  // Stub billing email templates — pass through but track
  if (id.includes("billing-email-templates")) {
    return {
      renderSubscriptionActivated: () => ({ subject: "s", text: "t", html: "h" }),
      renderSubscriptionCanceled: () => ({ subject: "s", text: "t", html: "h" }),
      renderSubscriptionReactivated: () => ({ subject: "s", text: "t", html: "h" }),
      renderPaymentFailed: () => ({ subject: "s", text: "t", html: "h" }),
      renderTrialEnding: () => ({ subject: "s", text: "t", html: "h" }),
      renderDisputeAlert: () => ({ subject: "s", text: "t", html: "h" }),
      renderInvoiceUpcoming: () => ({ subject: "s", text: "t", html: "h" }),
      renderProrationNotice: () => ({ subject: "s", text: "t", html: "h" }),
      renderSubscriptionPaused: () => ({ subject: "s", text: "t", html: "h" }),
      renderSubscriptionResumed: () => ({ subject: "s", text: "t", html: "h" }),
      renderRefundIssued: (opts) => ({
        subject: `Refund: $${(opts.amountCents / 100).toFixed(2)}`,
        text: `Refund of $${(opts.amountCents / 100).toFixed(2)}`,
        html: `<p>Refund: $${(opts.amountCents / 100).toFixed(2)}</p>`,
      }),
    };
  }
  // Stub token-chain-store
  if (id.includes("token-chain-store")) {
    return {
      createTokenChain: () => {},
      activateToken: () => {},
      hashToken: (t) => t,
    };
  }
  return originalRequire.apply(this, arguments);
};

// Require the router
const routerPath = path.resolve(__dirname, "..", "coming-soon", "routes", "subscriptions-billing.cjs");
const routerModule = require(routerPath);

// Build minimal express app with webhook endpoint
const app = express();
app.set("trust proxy", true);
app.use("/", routerModule.router);
// Mount the webhook handler
routerModule.setupSubscriptionWebhook(app);

// Helper: build a synthetic Stripe webhook event
function buildEvent(type, dataObject) {
  return JSON.stringify({
    id: "evt_test_" + Math.random().toString(36).slice(2),
    type,
    data: { object: dataObject },
  });
}

// Helper: sign a payload (our stubbed constructEvent ignores the signature)
function signPayload(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = "whsec_test";
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

// Helper: send a webhook event
function sendWebhook(port, eventPayload) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(eventPayload, "utf8");
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path: "/api/subscription/webhook",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body.length,
          "stripe-signature": signPayload(eventPayload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const server = app.listen(0, async () => {
  const port = server.address().port;
  let passed = 0;
  let failed = 0;

  function logResult(name, ok, detail) {
    console.log(`\n[${ok ? "PASS" : "FAIL"}] ${name}`);
    if (detail) console.log(`  ${detail}`);
    if (ok) passed++;
    else failed++;
  }

  try {
    // Test 1: Full refund — should mark subscription as 'refunded'
    emailCallLog.length = 0;
    dbCallLog.length = 0;
    const fullRefundEvent = buildEvent("charge.refunded", {
      id: "ch_test_full",
      amount: 4900,
      amount_refunded: 4900,
      currency: "usd",
      customer: "cus_test_123",
      billing_details: { email: "test@example.com" },
      refund_reason: "requested_by_customer",
    });
    const res1 = await sendWebhook(port, fullRefundEvent);
    const refundEmail1 = emailCallLog.find((e) => e.subject && e.subject.includes("Refund"));
    const dbUpdate1 = dbCallLog.find((d) => d.status === "refunded");
    logResult(
      "Full refund marks subscription as 'refunded'",
      res1.status === 200 && !!dbUpdate1,
      `HTTP ${res1.status}, DB update: ${dbUpdate1 ? dbUpdate1.status : "none"}`,
    );
    logResult(
      "Full refund sends refund email",
      !!refundEmail1,
      `Email to: ${refundEmail1 ? refundEmail1.to : "none"}`,
    );

    // Test 2: Partial refund — should still process but not full amount
    emailCallLog.length = 0;
    dbCallLog.length = 0;
    const partialRefundEvent = buildEvent("charge.refunded", {
      id: "ch_test_partial",
      amount: 4900,
      amount_refunded: 2000,
      currency: "usd",
      customer: "cus_test_123",
      billing_details: { email: "test@example.com" },
    });
    const res2 = await sendWebhook(port, partialRefundEvent);
    const refundEmail2 = emailCallLog.find((e) => e.subject && e.subject.includes("Refund"));
    logResult(
      "Partial refund processes successfully",
      res2.status === 200,
      `HTTP ${res2.status}`,
    );
    logResult(
      "Partial refund sends refund email with correct amount",
      !!refundEmail2 && refundEmail2.subject.includes("20.00"),
      `Subject: ${refundEmail2 ? refundEmail2.subject : "none"}`,
    );

    // Test 3: Refund with no customer email — should not crash
    emailCallLog.length = 0;
    dbCallLog.length = 0;
    const noEmailRefundEvent = buildEvent("charge.refunded", {
      id: "ch_test_noemail",
      amount: 4900,
      amount_refunded: 4900,
      currency: "usd",
      customer: "cus_test_123",
      billing_details: {},
    });
    const res3 = await sendWebhook(port, noEmailRefundEvent);
    logResult(
      "Refund with no customer email does not crash",
      res3.status === 200,
      `HTTP ${res3.status}, body: ${JSON.stringify(res3.body).slice(0, 80)}`,
    );

    // Test 4: Unknown event type — should be ignored gracefully
    const unknownEvent = buildEvent("some.unknown.event", { id: "x" });
    const res4 = await sendWebhook(port, unknownEvent);
    logResult(
      "Unknown event type is ignored",
      res4.status === 200 && res4.body.ignored === true,
      `HTTP ${res4.status}, body: ${JSON.stringify(res4.body).slice(0, 80)}`,
    );

    // Test 5: charge.refunded is in the allowed events set (not ignored)
    emailCallLog.length = 0;
    dbCallLog.length = 0;
    const allowedEvent = buildEvent("charge.refunded", {
      id: "ch_test_allowed",
      amount: 1000,
      amount_refunded: 1000,
      currency: "usd",
      billing_details: { email: "test@example.com" },
    });
    const res5 = await sendWebhook(port, allowedEvent);
    logResult(
      "charge.refunded is not ignored (processed, not ignored:true)",
      res5.status === 200 && res5.body.ignored !== true,
      `HTTP ${res5.status}, body: ${JSON.stringify(res5.body).slice(0, 80)}`,
    );
  } catch (err) {
    console.error("[ERROR] Test execution failed:", err.message);
    failed++;
  } finally {
    // Restore original require
    Module.prototype.require = originalRequire;
    console.log(`\n========================================`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
});
