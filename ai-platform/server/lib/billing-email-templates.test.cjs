"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
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

describe("billing-email-templates", () => {
  describe("renderSubscriptionActivated", () => {
    it("returns subject, text, and html for developer tier", () => {
      const result = renderSubscriptionActivated({ tier: "developer" });
      assert.ok(result.subject.includes("Subscription Activated"));
      assert.ok(result.text.includes("developer"));
      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("developer"));
    });

    it("includes seat info for team_pro tier", () => {
      const result = renderSubscriptionActivated({ tier: "team_pro" });
      assert.ok(result.text.includes("5 seats"));
      assert.ok(result.html.includes("5 seats"));
    });

    it("includes extra seats info when provided", () => {
      const result = renderSubscriptionActivated({
        tier: "team_pro",
        extraSeats: 3,
        totalSeats: 8,
      });
      assert.ok(result.text.includes("3 extra seats"));
      assert.ok(result.text.includes("8 total"));
      assert.ok(result.html.includes("3 extra seats"));
    });

    it("includes license token when provided", () => {
      const token = "sb_test_license_abc123";
      const result = renderSubscriptionActivated({
        tier: "pro",
        licenseToken: token,
      });
      assert.ok(result.text.includes(token));
      assert.ok(result.html.includes(token));
      assert.ok(result.html.includes("License Key"));
    });

    it("omits license token section when not provided", () => {
      const result = renderSubscriptionActivated({ tier: "pro" });
      assert.ok(!result.text.includes("License Key"));
      assert.ok(!result.html.includes("License Key"));
    });
  });

  describe("renderSubscriptionCanceled", () => {
    it("returns properly formatted cancellation email", () => {
      const result = renderSubscriptionCanceled();
      assert.ok(result.subject.includes("Canceled"));
      assert.ok(result.text.includes("canceled"));
      assert.ok(result.text.includes("free tier"));
      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("canceled"));
    });
  });

  describe("renderSubscriptionReactivated", () => {
    it("returns properly formatted reactivation email", () => {
      const result = renderSubscriptionReactivated();
      assert.ok(result.subject.includes("Reactivated"));
      assert.ok(result.text.includes("reactivated"));
      assert.ok(result.text.includes("restored"));
      assert.ok(result.html.includes("callout-success"));
    });
  });

  describe("renderPaymentFailed", () => {
    it("returns retry-pending email when nextRetry is set", () => {
      const result = renderPaymentFailed({
        attemptCount: 2,
        nextRetry: "2026-09-01T00:00:00Z",
      });
      assert.ok(result.subject.includes("Payment Failed"));
      assert.ok(!result.subject.includes("Final"));
      assert.ok(result.text.includes("attempt 2"));
      assert.ok(result.text.includes("retry the payment"));
      assert.ok(result.html.includes("callout-warning"));
    });

    it("returns final attempt email when nextRetry is null", () => {
      const result = renderPaymentFailed({ attemptCount: 4, nextRetry: null });
      assert.ok(result.subject.includes("Final Payment Attempt Failed"));
      assert.ok(result.text.includes("final retry attempt"));
      assert.ok(result.text.includes("deactivated"));
    });

    it("defaults attemptCount to 1", () => {
      const result = renderPaymentFailed({ nextRetry: null });
      assert.ok(result.text.includes("attempt 1"));
    });
  });

  describe("renderTrialEnding", () => {
    it("includes formatted trial end date", () => {
      const result = renderTrialEnding({ trialEnd: "2026-09-15T00:00:00Z" });
      assert.ok(result.subject.includes("Trial Ending Soon"));
      assert.ok(result.text.includes("2026"));
      assert.ok(result.html.includes("2026"));
    });

    it('falls back to "soon" when trialEnd is null', () => {
      const result = renderTrialEnding({ trialEnd: null });
      assert.ok(result.text.includes("soon"));
    });
  });

  describe("renderDisputeAlert", () => {
    it("includes all dispute metadata", () => {
      const result = renderDisputeAlert({
        chargeId: "ch_test_001",
        reason: "fraudulent",
        status: "needs_response",
        amountCents: 4900,
        currency: "usd",
      });
      assert.ok(result.subject.includes("DISPUTE ALERT"));
      assert.ok(result.subject.includes("fraudulent"));
      assert.ok(result.subject.includes("$49.00"));
      assert.ok(result.subject.includes("USD"));
      assert.ok(result.text.includes("ch_test_001"));
      assert.ok(result.text.includes("fraudulent"));
      assert.ok(result.text.includes("49.00"));
      assert.ok(result.text.includes("needs_response"));
      assert.ok(result.html.includes("ch_test_001"));
      assert.ok(result.html.includes("meta-row"));
    });

    it("handles missing amount gracefully", () => {
      const result = renderDisputeAlert({
        chargeId: "ch_test_002",
        reason: "unrecognized",
      });
      assert.ok(result.subject.includes("unknown"));
      assert.ok(result.text.includes("unknown"));
    });

    it("defaults reason and status when not provided", () => {
      const result = renderDisputeAlert({ chargeId: "ch_test_003" });
      assert.ok(result.text.includes("unspecified"));
      assert.ok(result.text.includes("needs_response"));
    });
  });

  describe("renderInvoiceUpcoming", () => {
    it("includes amount, currency, and due date in subject", () => {
      const result = renderInvoiceUpcoming({
        amountCents: 4900,
        currency: "usd",
        dueDate: "2026-09-15T00:00:00Z",
        tier: "developer",
      });
      assert.ok(result.subject.includes("Upcoming Payment"));
      assert.ok(result.subject.includes("$49.00"));
      assert.ok(result.subject.includes("USD"));
    });

    it("includes tier and amount in text body", () => {
      const result = renderInvoiceUpcoming({
        amountCents: 14900,
        currency: "usd",
        dueDate: "2026-09-15T00:00:00Z",
        tier: "team_pro",
      });
      assert.ok(result.text.includes("team_pro"));
      assert.ok(result.text.includes("$149.00"));
      assert.ok(result.text.includes("automated reminder"));
    });

    it("includes invoice number when provided", () => {
      const result = renderInvoiceUpcoming({
        amountCents: 4900,
        dueDate: "2026-09-15T00:00:00Z",
        invoiceNumber: "INV-2026-001",
      });
      assert.ok(result.text.includes("INV-2026-001"));
      assert.ok(result.html.includes("INV-2026-001"));
    });

    it("omits invoice number section when not provided", () => {
      const result = renderInvoiceUpcoming({
        amountCents: 4900,
        dueDate: "2026-09-15T00:00:00Z",
      });
      assert.ok(!result.text.includes("Invoice:"));
    });

    it("handles missing amount gracefully", () => {
      const result = renderInvoiceUpcoming({ dueDate: "2026-09-15T00:00:00Z" });
      assert.ok(result.subject.includes("unknown"));
    });

    it("html has branded layout with CTA button", () => {
      const result = renderInvoiceUpcoming({
        amountCents: 4900,
        dueDate: "2026-09-15T00:00:00Z",
      });
      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("Review Payment Method"));
      assert.ok(result.html.includes("callout-info"));
    });
  });

  describe("renderProrationNotice", () => {
    it("includes tier names in subject for upgrade", () => {
      const result = renderProrationNotice({
        fromTier: "developer",
        toTier: "team_pro",
        isUpgrade: true,
        daysRemaining: 20,
        netAdjustmentCents: 6667,
        netAdjustmentDisplay: "$66.67 charge",
      });
      assert.ok(result.subject.includes("Upgrade"));
      assert.ok(result.subject.includes("Developer"));
      assert.ok(result.subject.includes("Team Pro"));
    });

    it('uses "Change" in subject for downgrade', () => {
      const result = renderProrationNotice({
        fromTier: "team_pro",
        toTier: "developer",
        isUpgrade: false,
        daysRemaining: 15,
        netAdjustmentCents: -5000,
        netAdjustmentDisplay: "$50.00 credit",
      });
      assert.ok(result.subject.includes("Change"));
    });

    it("includes proration details in text body", () => {
      const result = renderProrationNotice({
        fromTier: "developer",
        toTier: "team_pro",
        isUpgrade: true,
        daysRemaining: 20,
        netAdjustmentCents: 6667,
        netAdjustmentDisplay: "$66.67 charge",
      });
      assert.ok(result.text.includes("upgraded"));
      assert.ok(result.text.includes("Developer"));
      assert.ok(result.text.includes("Team Pro"));
      assert.ok(result.text.includes("$66.67 charge"));
      assert.ok(result.text.includes("20 days"));
    });

    it("includes metadata grid in html", () => {
      const result = renderProrationNotice({
        fromTier: "developer",
        toTier: "team_pro",
        isUpgrade: true,
        daysRemaining: 20,
        netAdjustmentCents: 6667,
        netAdjustmentDisplay: "$66.67 charge",
      });
      assert.ok(result.html.includes("meta-row"));
      assert.ok(result.html.includes("Previous Plan"));
      assert.ok(result.html.includes("New Plan"));
      assert.ok(result.html.includes("Days Remaining"));
      assert.ok(result.html.includes("Proration Adjustment"));
    });

    it("uses info callout for upgrades", () => {
      const result = renderProrationNotice({
        fromTier: "developer",
        toTier: "team_pro",
        isUpgrade: true,
        daysRemaining: 20,
        netAdjustmentCents: 6667,
        netAdjustmentDisplay: "$66.67 charge",
      });
      assert.ok(result.html.includes("callout-info"));
    });

    it("uses success callout for downgrades", () => {
      const result = renderProrationNotice({
        fromTier: "team_pro",
        toTier: "developer",
        isUpgrade: false,
        daysRemaining: 15,
        netAdjustmentCents: -5000,
        netAdjustmentDisplay: "$50.00 credit",
      });
      assert.ok(result.html.includes("callout-success"));
    });

    it("indicates credit direction for negative adjustment", () => {
      const result = renderProrationNotice({
        fromTier: "team_pro",
        toTier: "developer",
        isUpgrade: false,
        daysRemaining: 15,
        netAdjustmentCents: -5000,
        netAdjustmentDisplay: "$50.00 credit",
      });
      assert.ok(result.text.includes("credited"));
    });

    it("indicates charge direction for positive adjustment", () => {
      const result = renderProrationNotice({
        fromTier: "developer",
        toTier: "team_pro",
        isUpgrade: true,
        daysRemaining: 20,
        netAdjustmentCents: 6667,
        netAdjustmentDisplay: "$66.67 charge",
      });
      assert.ok(result.text.includes("charged"));
    });

    it("includes annual cycle label when isAnnual is true", () => {
      const result = renderProrationNotice({
        fromTier: "developer",
        toTier: "team_pro",
        isUpgrade: true,
        daysRemaining: 200,
        netAdjustmentCents: 50000,
        netAdjustmentDisplay: "$500.00 charge",
        isAnnual: true,
      });
      assert.ok(result.text.includes("annual"));
      assert.ok(result.html.includes("Annual"));
    });
  });

  describe("renderSubscriptionPaused", () => {
    it("includes tier name in subject and text", () => {
      const result = renderSubscriptionPaused({ tier: "team_pro" });
      assert.ok(result.subject.includes("Subscription Paused"));
      assert.ok(result.text.includes("Team Pro"));
    });

    it("includes resume date when provided", () => {
      const result = renderSubscriptionPaused({
        tier: "developer",
        resumeDate: "2026-10-01T00:00:00Z",
      });
      assert.ok(result.text.includes("2026"));
      assert.ok(result.html.includes("2026"));
    });

    it("omits resume date when not provided", () => {
      const result = renderSubscriptionPaused({ tier: "developer" });
      assert.ok(!result.text.includes("no earlier than"));
    });

    it("uses warning callout in html", () => {
      const result = renderSubscriptionPaused({ tier: "developer" });
      assert.ok(result.html.includes("callout-warning"));
    });

    it("includes resume CTA button", () => {
      const result = renderSubscriptionPaused({ tier: "developer" });
      assert.ok(result.html.includes("Resume Subscription"));
    });
  });

  describe("renderSubscriptionResumed", () => {
    it("includes tier name in subject and text", () => {
      const result = renderSubscriptionResumed({ tier: "team_pro" });
      assert.ok(result.subject.includes("Subscription Resumed"));
      assert.ok(result.text.includes("Team Pro"));
    });

    it("uses success callout in html", () => {
      const result = renderSubscriptionResumed({ tier: "developer" });
      assert.ok(result.html.includes("callout-success"));
    });

    it("includes welcome back message", () => {
      const result = renderSubscriptionResumed({ tier: "developer" });
      assert.ok(result.text.includes("Thank you for coming back"));
      assert.ok(result.html.includes("Thank you for coming back"));
    });
  });

  describe("all templates share consistent layout", () => {
    const templates = [
      {
        name: "activated",
        fn: () => renderSubscriptionActivated({ tier: "pro" }),
      },
      { name: "canceled", fn: () => renderSubscriptionCanceled() },
      { name: "reactivated", fn: () => renderSubscriptionReactivated() },
      { name: "payment_failed", fn: () => renderPaymentFailed({}) },
      { name: "trial_ending", fn: () => renderTrialEnding({}) },
      {
        name: "dispute",
        fn: () => renderDisputeAlert({ chargeId: "ch_test" }),
      },
      {
        name: "invoice_upcoming",
        fn: () =>
          renderInvoiceUpcoming({
            amountCents: 4900,
            dueDate: "2026-09-15T00:00:00Z",
          }),
      },
      {
        name: "proration_notice",
        fn: () =>
          renderProrationNotice({
            fromTier: "developer",
            toTier: "team_pro",
            daysRemaining: 20,
            netAdjustmentCents: 6667,
            netAdjustmentDisplay: "$66.67 charge",
          }),
      },
      {
        name: "subscription_paused",
        fn: () => renderSubscriptionPaused({ tier: "developer" }),
      },
      {
        name: "subscription_resumed",
        fn: () => renderSubscriptionResumed({ tier: "developer" }),
      },
    ];

    for (const { name, fn } of templates) {
      it(`${name} returns all three fields (subject, text, html)`, () => {
        const result = fn();
        assert.ok(
          typeof result.subject === "string" && result.subject.length > 0,
          `${name} should have subject`,
        );
        assert.ok(
          typeof result.text === "string" && result.text.length > 0,
          `${name} should have text`,
        );
        assert.ok(
          typeof result.html === "string" && result.html.length > 0,
          `${name} should have html`,
        );
      });

      it(`${name} html has branded layout with header and footer`, () => {
        const result = fn();
        assert.ok(
          result.html.includes("<!DOCTYPE html>"),
          `${name} html should be a full document`,
        );
        assert.ok(
          result.html.includes("SimpleBeacon"),
          `${name} html should contain brand name`,
        );
        assert.ok(
          result.html.includes("header"),
          `${name} html should have header section`,
        );
        assert.ok(
          result.html.includes("footer"),
          `${name} html should have footer section`,
        );
      });
    }
  });
});
