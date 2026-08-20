"use strict";

const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("daily-ops-report", () => {
  let savedEnv;
  let tempLogDir;
  let tempQueueDir;

  before(() => {
    savedEnv = { ...process.env };
  });

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
  });

  beforeEach(() => {
    tempLogDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-ops-report-"));
    tempQueueDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "sb-ops-report-email-"),
    );
    process.env.WEBHOOK_EVENT_LOG = path.join(
      tempLogDir,
      "webhook-event-log.json",
    );
    process.env.EMAIL_QUEUE_DIR = tempQueueDir;
    process.env.OPS_REPORT_EMAIL = "ops-test@example.com";
    delete process.env.CF_API_TOKEN;
    delete process.env.CF_ACCOUNT_ID;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.OPS_REPORT_ENABLED;

    // Clear module cache so modules pick up new env vars
    delete require.cache[require.resolve("../lib/webhook-event-log.cjs")];
    delete require.cache[require.resolve("../lib/email-service.cjs")];
    delete require.cache[require.resolve("../lib/daily-ops-report.cjs")];
  });

  afterEach(() => {
    fs.rmSync(tempLogDir, { recursive: true, force: true });
    fs.rmSync(tempQueueDir, { recursive: true, force: true });
  });

  it("gatherDailyData returns empty summary when no events", () => {
    const { gatherDailyData } = require("../lib/daily-ops-report.cjs");
    const { summary, stats } = gatherDailyData();
    assert.strictEqual(summary.total, 0);
    assert.strictEqual(summary.paymentFailures.length, 0);
    assert.strictEqual(summary.disputes.length, 0);
    assert.ok(stats);
  });

  it("gatherDailyData categorizes events correctly", async () => {
    const {
      logWebhookEvent,
      clearCache,
    } = require("../lib/webhook-event-log.cjs");
    clearCache();

    await logWebhookEvent({
      eventId: "evt_1",
      eventType: "invoice.payment_failed",
      status: "processed",
      customerEmail: "fail@test.com",
      reason: "card_declined",
    });
    await logWebhookEvent({
      eventId: "evt_2",
      eventType: "charge.dispute.created",
      status: "processed",
      reason: "fraudulent",
      amount: "$49.00 USD",
    });
    await logWebhookEvent({
      eventId: "evt_3",
      eventType: "checkout.session.completed",
      status: "processed",
      customerEmail: "ok@test.com",
      amount: "$49.00",
    });
    await logWebhookEvent({
      eventId: "evt_4",
      eventType: "customer.subscription.deleted",
      status: "processed",
      customerEmail: "cancel@test.com",
    });
    await logWebhookEvent({
      eventId: "evt_5",
      eventType: "customer.subscription.trial_will_end",
      status: "processed",
      customerEmail: "trial@test.com",
    });
    await logWebhookEvent({
      eventId: "evt_6",
      eventType: "invoice.paid",
      status: "error",
      detail: "handler crashed",
    });

    delete require.cache[require.resolve("../lib/daily-ops-report.cjs")];
    const { gatherDailyData } = require("../lib/daily-ops-report.cjs");
    const { summary } = gatherDailyData();

    assert.strictEqual(summary.total, 6);
    assert.strictEqual(summary.paymentFailures.length, 1);
    assert.strictEqual(summary.disputes.length, 1);
    assert.strictEqual(summary.trialWarnings.length, 1);
    assert.strictEqual(summary.cancellations.length, 1);
    assert.strictEqual(summary.successfulPayments.length, 2);
    assert.strictEqual(summary.errors.length, 1);
    assert.strictEqual(summary.byType["invoice.payment_failed"], 1);
    assert.strictEqual(summary.byStatus.processed, 5);
    assert.strictEqual(summary.byStatus.error, 1);
  });

  it("generateTextReport produces readable text with all sections", () => {
    const { generateTextReport } = require("../lib/daily-ops-report.cjs");
    const summary = {
      total: 3,
      byType: {
        "invoice.payment_failed": 1,
        "charge.dispute.created": 1,
        "checkout.session.completed": 1,
      },
      byStatus: { processed: 3 },
      paymentFailures: [
        {
          customerEmail: "fail@test.com",
          reason: "card_declined",
          timestamp: new Date().toISOString(),
        },
      ],
      disputes: [
        {
          reason: "fraudulent",
          amount: "$49.00 USD",
          timestamp: new Date().toISOString(),
        },
      ],
      trialWarnings: [],
      successfulPayments: [
        {
          eventType: "checkout.session.completed",
          customerEmail: "ok@test.com",
          amount: "$49.00",
          timestamp: new Date().toISOString(),
        },
      ],
      cancellations: [],
      errors: [],
    };
    const text = generateTextReport(summary, "Test Date");
    assert.ok(text.includes("Daily Operations Report"));
    assert.ok(text.includes("Total webhook events (24h): 3"));
    assert.ok(text.includes("Payment Failures (1)"));
    assert.ok(text.includes("fail@test.com"));
    assert.ok(text.includes("Disputes (1)"));
    assert.ok(text.includes("fraudulent"));
    assert.ok(text.includes("Successful Payments (1)"));
    // Trial warnings section only appears when there are trial warning events
    assert.ok(
      !text.includes("Trial Ending Warnings"),
      "empty sections should not appear",
    );
  });

  it("generateHtmlReport produces valid HTML with stat cards", () => {
    const { generateHtmlReport } = require("../lib/daily-ops-report.cjs");
    const summary = {
      total: 5,
      byType: {
        "invoice.payment_failed": 2,
        "charge.dispute.created": 1,
        "checkout.session.completed": 2,
      },
      byStatus: { processed: 4, error: 1 },
      paymentFailures: [
        {
          customerEmail: "a@test.com",
          reason: "declined",
          amount: null,
          timestamp: new Date().toISOString(),
        },
      ],
      disputes: [
        {
          reason: "fraudulent",
          amount: "$49.00 USD",
          timestamp: new Date().toISOString(),
        },
      ],
      trialWarnings: [],
      successfulPayments: [],
      cancellations: [],
      errors: [
        {
          eventType: "invoice.paid",
          detail: "crash",
          timestamp: new Date().toISOString(),
        },
      ],
    };
    const html = generateHtmlReport(summary, "Test Date");
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("stat-card"));
    assert.ok(html.includes("stat-grid"));
    assert.ok(html.includes("Payment Failures"));
    assert.ok(html.includes("5"));
  });

  it("sendDailyReport queues email when no provider configured", async () => {
    const { sendDailyReport } = require("../lib/daily-ops-report.cjs");
    const result = await sendDailyReport();
    assert.ok(result.queued || result.sent);
    if (result.queued) {
      const queuedEmails = fs
        .readdirSync(tempQueueDir)
        .filter((f) => f.endsWith(".json"));
      assert.ok(
        queuedEmails.length > 0,
        "report email should be queued to disk",
      );
      const emailContent = JSON.parse(
        fs.readFileSync(path.join(tempQueueDir, queuedEmails[0]), "utf8"),
      );
      assert.ok(emailContent.subject.includes("Daily Ops Report"));
      assert.ok(emailContent.to === "ops-test@example.com");
    }
  });

  it("shouldSendNow returns false when hour does not match", () => {
    const { shouldSendNow } = require("../lib/daily-ops-report.cjs");
    process.env.OPS_REPORT_HOUR = "25";
    assert.strictEqual(shouldSendNow(), false);
  });

  it("startScheduler does nothing when OPS_REPORT_ENABLED is not set", () => {
    const {
      startScheduler,
      stopScheduler,
    } = require("../lib/daily-ops-report.cjs");
    startScheduler();
    stopScheduler();
  });

  it("startScheduler starts when OPS_REPORT_ENABLED=true", () => {
    process.env.OPS_REPORT_ENABLED = "true";
    delete require.cache[require.resolve("../lib/daily-ops-report.cjs")];
    const {
      startScheduler,
      stopScheduler,
    } = require("../lib/daily-ops-report.cjs");
    startScheduler();
    stopScheduler();
  });

  it("report excludes events older than 24 hours", async () => {
    const {
      logWebhookEvent,
      clearCache,
    } = require("../lib/webhook-event-log.cjs");
    clearCache();

    // Log an event with an old timestamp by directly writing to the store
    const storePath = process.env.WEBHOOK_EVENT_LOG;
    const oldEvent = {
      eventId: "evt_old",
      eventType: "invoice.payment_failed",
      customerEmail: "old@test.com",
      status: "processed",
      tier: null,
      amount: null,
      reason: "card_declined",
      detail: "Payment failed",
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    };
    const recentEvent = {
      eventId: "evt_recent",
      eventType: "checkout.session.completed",
      customerEmail: "new@test.com",
      status: "processed",
      tier: null,
      amount: "$49.00",
      reason: null,
      detail: "Subscription activated",
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(
      storePath,
      JSON.stringify(
        {
          events: [recentEvent, oldEvent],
          updatedAt: new Date().toISOString(),
          count: 2,
        },
        null,
        2,
      ),
    );

    delete require.cache[require.resolve("../lib/daily-ops-report.cjs")];
    const { gatherDailyData } = require("../lib/daily-ops-report.cjs");
    const { summary } = gatherDailyData();

    assert.strictEqual(
      summary.total,
      1,
      "should only count events from last 24h",
    );
    assert.strictEqual(summary.successfulPayments.length, 1);
    assert.strictEqual(
      summary.paymentFailures.length,
      0,
      "old payment failure should be excluded",
    );
  });
});
