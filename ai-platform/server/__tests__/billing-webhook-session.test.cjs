"use strict";

/**
 * One-time $499 checkout.session.completed must persist sessionTokenStore
 * under Stripe cs_… and serve GET /api/session-token/:sessionId.
 *
 * node:test + fetch. Does not call Render. licenseTier for
 * executive_clearance is "executive" (PRODUCT_TIER_MAP).
 */

process.env.NODE_ENV = "development";
process.env.DEV_AUTH_BYPASS = "1";
process.env.ALLOW_DEV_EPHEMERAL_SECRETS = "true";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret_placeholder_54200";
process.env.SIMPLEBEACON_LICENSE_SECRET = "test-license-secret-placeholder";
process.env.SIMPLEBEACON_SUBSCRIPTION_STORE = require("path").join(
  require("os").tmpdir(),
  "sb-billing-webhook-session-subscriptions.json",
);
process.env.EMAIL_QUEUE_DIR = require("path").join(
  require("os").tmpdir(),
  "sb-billing-webhook-email-queue",
);

const fs = require("fs");
const path = require("path");
const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const Stripe = require("stripe");

const licenseUtilsPath = require.resolve("../../src/api/billing/license-utils.cjs");
const realLicenseUtils = require(licenseUtilsPath);
function getStripeClient() {
  const client = Stripe("sk_test_placeholder");
  client.checkout.sessions.listLineItems = async () => ({ data: [] });
  return client;
}
require.cache[licenseUtilsPath].exports = {
  ...realLicenseUtils,
  getStripeClient,
};

const {
  setupSimplebeaconBillingWebhook,
} = require("../../src/api/simplebeacon-billing-api.cjs");
const sessionTokenStore = require("../../../coming-soon/routes/session-token-store.cjs");

const SESSION_ID = "cs_test_499execClear01";
const BUYER_EMAIL = "exec-buyer@example.com";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

describe("billing webhook one-time session token persist", () => {
  const app = express();
  setupSimplebeaconBillingWebhook(app);
  app.get("/api/session-token/:sessionId", (req, res) => {
    const entry = sessionTokenStore.get(req.params.sessionId);
    if (!entry) {
      return res.status(404).json({ error: "Session not found or expired." });
    }
    return res.json({
      success: true,
      token: entry.token,
      email: entry.email,
      projectName: entry.projectName,
      tier: entry.tier,
    });
  });
  const server = app.listen(0);
  const port = server.address().port;

  after(() => {
    server.close();
    try {
      fs.unlinkSync(process.env.SIMPLEBEACON_SUBSCRIPTION_STORE);
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(process.env.EMAIL_QUEUE_DIR, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("checkout.session.completed payment/executive_clearance is queryable by cs_ id", async () => {
    const event = {
      id: "evt_test_exec_499",
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: SESSION_ID,
          object: "checkout.session",
          mode: "payment",
          payment_status: "paid",
          customer_email: BUYER_EMAIL,
          customer_details: { email: BUYER_EMAIL },
          metadata: {
            product: "executive_clearance",
            projectName: "board-pack",
            certProjectName: "board-pack",
          },
        },
      },
    };
    const payload = JSON.stringify(event);
    const stripe = Stripe("sk_test_placeholder");
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const postRes = await fetch(
      `http://127.0.0.1:${port}/api/simplebeacon/billing/webhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "stripe-signature": header,
        },
        body: payload,
      },
    );
    const postBody = await postRes.json().catch(() => ({}));
    assert.equal(postRes.status, 200, JSON.stringify(postBody));

    const stored = sessionTokenStore.get(SESSION_ID);
    assert.ok(stored, "sessionTokenStore should contain cs_ id");
    assert.equal(String(stored.email).toLowerCase(), BUYER_EMAIL);
    assert.equal(stored.tier, "executive");
    assert.ok(stored.token && stored.token.includes("."));

    const getRes = await fetch(
      `http://127.0.0.1:${port}/api/session-token/${SESSION_ID}`,
    );
    const getBody = await getRes.json();
    assert.equal(getRes.status, 200, JSON.stringify(getBody));
    assert.equal(getBody.success, true);
    assert.equal(getBody.token, stored.token);
    assert.equal(String(getBody.email).toLowerCase(), BUYER_EMAIL);
    assert.equal(getBody.tier, "executive");
    assert.equal(
      path.basename(process.env.SIMPLEBEACON_SUBSCRIPTION_STORE).includes(
        "billing-webhook-session",
      ),
      true,
    );
  });
});
