"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isReferralNudgeDisabled,
  resolveReferralNudgeContext,
  runReferralNudge,
} = require("../src/lib/referral-cli.js");
const { formatReferralNudgeBanner } = require("../src/reporters/text.js");

describe("referral nudge", () => {
  test("isReferralNudgeDisabled respects flag and env", () => {
    const original = process.env.SIMPLEBEACON_REFERRAL_NUDGE;
    delete process.env.SIMPLEBEACON_REFERRAL_NUDGE;
    try {
      assert.equal(isReferralNudgeDisabled({}), false);
      assert.equal(isReferralNudgeDisabled({ noReferralNudge: true }), true);
      process.env.SIMPLEBEACON_REFERRAL_NUDGE = "false";
      assert.equal(isReferralNudgeDisabled({}), true);
      process.env.SIMPLEBEACON_REFERRAL_NUDGE = "0";
      assert.equal(isReferralNudgeDisabled({}), true);
    } finally {
      if (original === undefined)
        delete process.env.SIMPLEBEACON_REFERRAL_NUDGE;
      else process.env.SIMPLEBEACON_REFERRAL_NUDGE = original;
    }
  });

  test("formatReferralNudgeBanner includes share link and refer command", () => {
    process.env.NO_COLOR = "1";
    const banner = formatReferralNudgeBanner({
      shareUrl: "https://simplebeacon.ai/?ref=abc123",
      partnerCode: "abc123",
      personalized: true,
    });
    assert.match(banner, /Scan Passed!/);
    assert.match(banner, /https:\/\/simplebeacon\.ai\/\?ref=abc123/);
    assert.match(banner, /simplebeacon refer --link/);
    assert.match(banner, /Partner code: abc123/);
    assert.match(banner, /^┌/m);
    delete process.env.NO_COLOR;
  });

  test("resolveReferralNudgeContext degrades when offline", async () => {
    const original = process.env.SIMPLEBEACON_REFERRER_EMAIL;
    process.env.SIMPLEBEACON_REFERRER_EMAIL = "dev@example.com";
    try {
      const context = await resolveReferralNudgeContext({ offline: true });
      assert.equal(context.personalized, false);
      assert.match(context.shareUrl, /^https:\/\/simplebeacon\.ai\/?$/);
    } finally {
      if (original === undefined)
        delete process.env.SIMPLEBEACON_REFERRER_EMAIL;
      else process.env.SIMPLEBEACON_REFERRER_EMAIL = original;
    }
  });

  test("runReferralNudge skips on gate failure", async () => {
    const chunks = [];
    await runReferralNudge(
      {},
      { pass: false },
      {
        writeErr: (msg) => chunks.push(msg),
      },
    );
    assert.equal(chunks.length, 0);
  });

  test("runReferralNudge prints banner on gate pass", async () => {
    const chunks = [];
    await runReferralNudge(
      { offline: true },
      { pass: true },
      {
        writeErr: (msg) => chunks.push(msg),
      },
    );
    assert.equal(chunks.length, 1);
    assert.match(chunks.join(""), /Scan Passed!/);
  });

  test("runReferralNudge honors --no-referral-nudge", async () => {
    const chunks = [];
    await runReferralNudge(
      { noReferralNudge: true, offline: true },
      { pass: true },
      {
        writeErr: (msg) => chunks.push(msg),
      },
    );
    assert.equal(chunks.length, 0);
  });
});
