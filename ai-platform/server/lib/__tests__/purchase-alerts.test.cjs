"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

describe("purchase-alerts", () => {
  const {
    sendPurchaseAlert,
    maskEmail,
    buildSlackPayload,
    buildDiscordPayload,
  } = require("../purchase-alerts.cjs");

  let savedEnv;

  before(() => {
    savedEnv = { ...process.env };
    delete process.env.PURCHASE_ALERT_WEBHOOK;
  });

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
  });

  describe("maskEmail", () => {
    it("masks the local part of a standard email", () => {
      assert.strictEqual(
        maskEmail("jane.developer@company.com"),
        "j***r@company.com",
      );
    });

    it("masks short local parts correctly", () => {
      assert.strictEqual(maskEmail("ab@test.com"), "a***b@test.com");
    });

    it("returns email as-is for very short local parts", () => {
      assert.strictEqual(maskEmail("a@test.com"), "a@test.com");
    });

    it("returns unknown for null/undefined", () => {
      assert.strictEqual(maskEmail(null), "unknown");
      assert.strictEqual(maskEmail(undefined), "unknown");
    });

    it("returns unknown for empty string", () => {
      assert.strictEqual(maskEmail(""), "unknown");
    });
  });

  describe("buildSlackPayload", () => {
    it("includes tier and masked email in fields", () => {
      var payload = buildSlackPayload({
        tier: "developer",
        email: "jane@example.com",
        priceId: "price_developer_monthly",
        amount: 4900,
        customerId: "cus_123",
      });
      assert.ok(payload.text);
      assert.ok(payload.attachments);
      assert.strictEqual(payload.attachments.length, 1);
      var fields = payload.attachments[0].fields;
      var tierField = fields.find(function (f) {
        return f.title === "Tier";
      });
      assert.strictEqual(tierField.value, "developer");
      var customerField = fields.find(function (f) {
        return f.title === "Customer";
      });
      assert.strictEqual(customerField.value, "j***e@example.com");
    });

    it("formats amount as dollars", () => {
      var payload = buildSlackPayload({
        tier: "team_pro",
        email: "a@b.com",
        amount: 14900,
      });
      var amountField = payload.attachments[0].fields.find(function (f) {
        return f.title === "Amount";
      });
      assert.strictEqual(amountField.value, "$149.00");
    });

    it("shows N/A for missing amount", () => {
      var payload = buildSlackPayload({ tier: "enterprise", email: "a@b.com" });
      var amountField = payload.attachments[0].fields.find(function (f) {
        return f.title === "Amount";
      });
      assert.strictEqual(amountField.value, "N/A");
    });
  });

  describe("buildDiscordPayload", () => {
    it("includes embeds with tier and masked email", () => {
      var payload = buildDiscordPayload({
        tier: "team_pro",
        email: "alice@example.com",
        priceId: "price_team_pro_monthly",
        amount: 14900,
        customerId: "cus_456",
      });
      assert.ok(payload.embeds);
      assert.strictEqual(payload.embeds.length, 1);
      var embed = payload.embeds[0];
      var tierField = embed.fields.find(function (f) {
        return f.name === "Tier";
      });
      assert.strictEqual(tierField.value, "team_pro");
      var customerField = embed.fields.find(function (f) {
        return f.name === "Customer";
      });
      assert.strictEqual(customerField.value, "a***e@example.com");
    });
  });

  describe("sendPurchaseAlert", () => {
    it("returns sent:false when PURCHASE_ALERT_WEBHOOK not set", async () => {
      delete process.env.PURCHASE_ALERT_WEBHOOK;
      var result = await sendPurchaseAlert({
        tier: "developer",
        email: "a@b.com",
      });
      assert.strictEqual(result.sent, false);
      assert.strictEqual(result.platform, null);
    });

    it("returns sent:false for non-Slack/non-Discord URL", async () => {
      process.env.PURCHASE_ALERT_WEBHOOK = "https://example.com/webhook";
      var result = await sendPurchaseAlert({
        tier: "developer",
        email: "a@b.com",
      });
      assert.strictEqual(result.sent, false);
      assert.strictEqual(result.platform, null);
    });

    it("attempts to send to Slack URL (may fail without real endpoint)", async () => {
      process.env.PURCHASE_ALERT_WEBHOOK =
        "https://hooks.slack.com/services/T000/B000/XXX";
      var result = await sendPurchaseAlert({
        tier: "developer",
        email: "dev@example.com",
        amount: 4900,
      });
      assert.strictEqual(result.platform, "slack");
      // sent may be true or false depending on network, but platform should be detected
    });

    it("attempts to send to Discord URL (may fail without real endpoint)", async () => {
      process.env.PURCHASE_ALERT_WEBHOOK =
        "https://discord.com/api/webhooks/000/xxx";
      var result = await sendPurchaseAlert({
        tier: "team_pro",
        email: "team@example.com",
        amount: 14900,
      });
      assert.strictEqual(result.platform, "discord");
    });
  });
});
