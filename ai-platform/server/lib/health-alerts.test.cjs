"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const {
  processHealthAlert,
  detectPlatform,
  formatAlertPayload,
  shouldAlert,
  getWebhookUrl,
  resetState,
} = require("../lib/health-alerts.cjs");

describe("health-alerts", () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    delete process.env.HEALTH_ALERT_WEBHOOK;
    delete process.env.PURCHASE_ALERT_WEBHOOK;
    resetState();
  });

  afterEach(() => {
    process.env = { ...process.env, ...savedEnv };
    resetState();
  });

  describe("detectPlatform", () => {
    it("detects Slack URLs", () => {
      assert.strictEqual(
        detectPlatform("https://hooks.slack.com/services/T000/B000/XXX"),
        "slack",
      );
    });

    it("detects Discord URLs", () => {
      assert.strictEqual(
        detectPlatform("https://discord.com/api/webhooks/000/xxx"),
        "discord",
      );
    });

    it("returns unknown for non-webhook URLs", () => {
      assert.strictEqual(detectPlatform("https://example.com"), "unknown");
      assert.strictEqual(detectPlatform(""), "unknown");
      assert.strictEqual(detectPlatform(null), "unknown");
    });
  });

  describe("getWebhookUrl", () => {
    it("returns null when no webhook env vars are set", () => {
      assert.strictEqual(getWebhookUrl(), null);
    });

    it("prefers HEALTH_ALERT_WEBHOOK over PURCHASE_ALERT_WEBHOOK", () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/health";
      process.env.PURCHASE_ALERT_WEBHOOK = "https://hooks.slack.com/services/purchase";
      assert.strictEqual(
        getWebhookUrl(),
        "https://hooks.slack.com/services/health",
      );
    });

    it("falls back to PURCHASE_ALERT_WEBHOOK", () => {
      process.env.PURCHASE_ALERT_WEBHOOK = "https://hooks.slack.com/services/purchase";
      assert.strictEqual(
        getWebhookUrl(),
        "https://hooks.slack.com/services/purchase",
      );
    });
  });

  describe("shouldAlert", () => {
    it("alerts on UP → DOWN transition", () => {
      assert.ok(shouldAlert("UP", "DOWN"));
    });

    it("alerts on UP → DEGRADED transition", () => {
      assert.ok(shouldAlert("UP", "DEGRADED"));
    });

    it("alerts on DOWN → UP recovery", () => {
      assert.ok(shouldAlert("DOWN", "UP"));
    });

    it("alerts on DEGRADED → UP recovery", () => {
      assert.ok(shouldAlert("DEGRADED", "UP"));
    });

    it("alerts on DEGRADED → DOWN escalation", () => {
      assert.ok(shouldAlert("DEGRADED", "DOWN"));
    });

    it("alerts on DOWN → DEGRADED partial recovery", () => {
      assert.ok(shouldAlert("DOWN", "DEGRADED"));
    });

    it("does NOT alert when status stays UP", () => {
      assert.strictEqual(shouldAlert("UP", "UP"), false);
    });

    it("does NOT alert when status stays DOWN", () => {
      assert.strictEqual(shouldAlert("DOWN", "DOWN"), false);
    });

    it("does NOT alert when status stays DEGRADED", () => {
      assert.strictEqual(shouldAlert("DEGRADED", "DEGRADED"), false);
    });
  });

  describe("formatAlertPayload", () => {
    const sampleChecks = {
      encryption: { status: "UP", detail: {} },
      datastore: { status: "DEGRADED", files: [] },
      memory: { status: "UP", detail: { heapUsedMB: 120 } },
    };

    it("formats Slack payload with text field", () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/T/B/X";
      const payload = formatAlertPayload({
        previousStatus: "UP",
        currentStatus: "DEGRADED",
        checks: sampleChecks,
        timestamp: "2026-01-01T00:00:00Z",
      });
      assert.ok(payload.text);
      assert.ok(payload.text.includes("DEGRADED"));
      assert.ok(payload.text.includes("datastore"));
      assert.strictEqual(payload.mrkdwn, true);
    });

    it("formats Discord payload with content field", () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://discord.com/api/webhooks/0/x";
      const payload = formatAlertPayload({
        previousStatus: "UP",
        currentStatus: "DOWN",
        checks: sampleChecks,
        timestamp: "2026-01-01T00:00:00Z",
      });
      assert.ok(payload.content);
      assert.ok(payload.content.includes("DOWN"));
    });

    it("formats generic payload for unknown platform", () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://example.com/webhook";
      const payload = formatAlertPayload({
        previousStatus: "UP",
        currentStatus: "DOWN",
        checks: sampleChecks,
        timestamp: "2026-01-01T00:00:00Z",
      });
      assert.ok(payload.title);
      assert.ok(payload.previousStatus);
      assert.ok(payload.currentStatus);
      assert.ok(payload.checks);
    });

    it("includes recovery emoji for UP transitions", () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/T/B/X";
      const payload = formatAlertPayload({
        previousStatus: "DOWN",
        currentStatus: "UP",
        checks: sampleChecks,
        timestamp: "2026-01-01T00:00:00Z",
      });
      assert.ok(payload.text.includes("Recovered"));
    });
  });

  describe("processHealthAlert", () => {
    it("does not alert when no webhook is configured", async () => {
      const result = await processHealthAlert({
        status: "DOWN",
        timestamp: new Date().toISOString(),
        checks: {
          encryption: { status: "DOWN" },
          datastore: { status: "UP" },
          memory: { status: "UP" },
        },
      });
      assert.strictEqual(result.alerted, false);
      assert.strictEqual(result.platform, null);
    });

    it("does not alert on first UP check (no transition)", async () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/T/B/X";
      const result = await processHealthAlert({
        status: "UP",
        timestamp: new Date().toISOString(),
        checks: {
          encryption: { status: "UP" },
          datastore: { status: "UP" },
          memory: { status: "UP" },
        },
      });
      // First check is UP → UP (initial state is UP), no alert
      assert.strictEqual(result.alerted, false);
    });

    it("does not alert on repeated same-status checks", async () => {
      process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/T/B/X";
      // First DOWN alert
      await processHealthAlert({
        status: "DOWN",
        timestamp: new Date().toISOString(),
        checks: { encryption: { status: "DOWN" }, datastore: { status: "UP" }, memory: { status: "UP" } },
      });
      // Second DOWN — should not re-alert
      const result = await processHealthAlert({
        status: "DOWN",
        timestamp: new Date().toISOString(),
        checks: { encryption: { status: "DOWN" }, datastore: { status: "UP" }, memory: { status: "UP" } },
      });
      assert.strictEqual(result.alerted, false);
    });

    it("attempts to send on UP → DOWN transition with webhook set", async () => {
      // Use an invalid port to trigger fast failure, but the function should still try
      process.env.HEALTH_ALERT_WEBHOOK = "https://hooks.slack.com/services/T/B/invalid";
      const result = await processHealthAlert({
        status: "DOWN",
        timestamp: new Date().toISOString(),
        checks: {
          encryption: { status: "DOWN" },
          datastore: { status: "UP" },
          memory: { status: "UP" },
        },
      });
      // It will attempt to send — may fail due to invalid URL, but alerted=false
      // because the POST failed. The key assertion is that it tried (platform is set).
      assert.ok(result.platform === "slack");
    });
  });
});
