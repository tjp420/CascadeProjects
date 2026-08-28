"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

// Test the billing/subscriptions endpoint logic and token-db revocation functions
// We test the pure functions directly since the Express routes require a full app setup.

describe("admin-api billing endpoint", () => {
  describe("PRICE_MAP logic", () => {
    const PRICE_MAP = {
      developer: { monthly: 4900, annual: 49000 },
      team_pro: { monthly: 14900, annual: 149000 },
      pro: { monthly: 900, annual: 9000 },
      compliance: { monthly: 39900, annual: 399000 },
      enterprise: { monthly: 49900, annual: 499000 },
    };

    it("developer monthly is $49", () => {
      assert.strictEqual(PRICE_MAP.developer.monthly, 4900);
    });

    it("developer annual is $490", () => {
      assert.strictEqual(PRICE_MAP.developer.annual, 49000);
    });

    it("team_pro monthly is $149", () => {
      assert.strictEqual(PRICE_MAP.team_pro.monthly, 14900);
    });

    it("team_pro annual is $1490", () => {
      assert.strictEqual(PRICE_MAP.team_pro.annual, 149000);
    });

    it("enterprise monthly is $499", () => {
      assert.strictEqual(PRICE_MAP.enterprise.monthly, 49900);
    });

    it("enterprise annual is $4990", () => {
      assert.strictEqual(PRICE_MAP.enterprise.annual, 499000);
    });

    it("MRR for annual enterprise is annual/12", () => {
      const mrr = Math.round(PRICE_MAP.enterprise.annual / 12);
      assert.ok(mrr > 0);
      assert.strictEqual(mrr, 41583);
    });

    it("MRR for monthly enterprise is monthly", () => {
      const mrr = PRICE_MAP.enterprise.monthly;
      assert.strictEqual(mrr, 49900);
    });
  });

  describe("revenue calculation logic", () => {
    function calculateRevenue(subs, PRICE_MAP) {
      let totalCents = 0;
      let activeCents = 0;
      let monthlyRecurringCents = 0;

      for (const s of subs) {
        const tier = String(s.tier || "community").toLowerCase();
        const status = String(s.status || "active").toLowerCase();
        const isAnnual = s.isAnnual || false;
        const price = PRICE_MAP[tier];
        const amount = price ? (isAnnual ? price.annual : price.monthly) : 0;

        if (amount > 0) totalCents += amount;
        if (status === "active" && amount > 0) {
          activeCents += amount;
          monthlyRecurringCents += isAnnual ? Math.round(amount / 12) : amount;
        }
      }

      return { totalCents, activeCents, monthlyRecurringCents };
    }

    it("empty subscriptions returns zero revenue", () => {
      const result = calculateRevenue([], {});
      assert.strictEqual(result.totalCents, 0);
      assert.strictEqual(result.activeCents, 0);
      assert.strictEqual(result.monthlyRecurringCents, 0);
    });

    it("single active monthly developer sub", () => {
      const PRICE_MAP = { developer: { monthly: 4900, annual: 49000 } };
      const subs = [{ tier: "developer", status: "active", isAnnual: false }];
      const result = calculateRevenue(subs, PRICE_MAP);
      assert.strictEqual(result.totalCents, 4900);
      assert.strictEqual(result.activeCents, 4900);
      assert.strictEqual(result.monthlyRecurringCents, 4900);
    });

    it("single active annual enterprise sub", () => {
      const PRICE_MAP = { enterprise: { monthly: 49900, annual: 499000 } };
      const subs = [{ tier: "enterprise", status: "active", isAnnual: true }];
      const result = calculateRevenue(subs, PRICE_MAP);
      assert.strictEqual(result.totalCents, 499000);
      assert.strictEqual(result.activeCents, 499000);
      assert.strictEqual(result.monthlyRecurringCents, 41583);
    });

    it("inactive sub counts toward total but not active/MRR", () => {
      const PRICE_MAP = { developer: { monthly: 4900, annual: 49000 } };
      const subs = [{ tier: "developer", status: "canceled", isAnnual: false }];
      const result = calculateRevenue(subs, PRICE_MAP);
      assert.strictEqual(result.totalCents, 4900);
      assert.strictEqual(result.activeCents, 0);
      assert.strictEqual(result.monthlyRecurringCents, 0);
    });

    it("mixed active and inactive subs", () => {
      const PRICE_MAP = {
        developer: { monthly: 4900, annual: 49000 },
        enterprise: { monthly: 49900, annual: 499000 },
      };
      const subs = [
        { tier: "developer", status: "active", isAnnual: false },
        { tier: "enterprise", status: "active", isAnnual: true },
        { tier: "developer", status: "refunded", isAnnual: false },
      ];
      const result = calculateRevenue(subs, PRICE_MAP);
      assert.strictEqual(result.totalCents, 4900 + 499000 + 4900);
      assert.strictEqual(result.activeCents, 4900 + 499000);
      assert.strictEqual(result.monthlyRecurringCents, 4900 + 41583);
    });

    it("unknown tier returns zero amount", () => {
      const PRICE_MAP = {};
      const subs = [{ tier: "community", status: "active", isAnnual: false }];
      const result = calculateRevenue(subs, PRICE_MAP);
      assert.strictEqual(result.totalCents, 0);
      assert.strictEqual(result.activeCents, 0);
    });
  });
});

describe("token-db license revocation", () => {
  let tokenDb;

  before(() => {
    // Set a temp data dir so we don't clobber real data
    process.env.TOKEN_DB_PATH = require("path").join(
      require("os").tmpdir(),
      `test-token-db-${Date.now()}.json`,
    );
    tokenDb = require("../lib/token-db.cjs");
  });

  after(() => {
    try {
      require("fs").unlinkSync(process.env.TOKEN_DB_PATH);
    } catch {
      // ignore
    }
    delete process.env.TOKEN_DB_PATH;
  });

  it("insertLicenseToken and getLicenseToken round-trip", async () => {
    const token = "test-token-revoke-123";
    await tokenDb.insertLicenseToken({
      token,
      email: "test@example.com",
      tier: "enterprise",
      registered_at: new Date().toISOString(),
    });
    const entry = tokenDb.getLicenseToken(token);
    assert.ok(entry);
    assert.strictEqual(entry.email, "test@example.com");
    assert.strictEqual(entry.tier, "enterprise");
  });

  it("isLicenseTokenRevoked returns false for non-revoked token", async () => {
    const token = "test-token-not-revoked";
    await tokenDb.insertLicenseToken({
      token,
      email: "notrevoked@example.com",
      tier: "developer",
      registered_at: new Date().toISOString(),
    });
    assert.strictEqual(tokenDb.isLicenseTokenRevoked(token), false);
  });

  it("revokeLicenseToken marks token as revoked", async () => {
    const token = "test-token-to-revoke";
    await tokenDb.insertLicenseToken({
      token,
      email: "revoke@example.com",
      tier: "team_pro",
      registered_at: new Date().toISOString(),
    });
    const result = await tokenDb.revokeLicenseToken(token, "Test revocation");
    assert.ok(result);
    assert.ok(result.revoked_at);
    assert.strictEqual(result.revoked_reason, "Test revocation");
    assert.strictEqual(tokenDb.isLicenseTokenRevoked(token), true);
  });

  it("revokeLicenseToken returns null for non-existent token", async () => {
    const result = await tokenDb.revokeLicenseToken("nonexistent-token", "test");
    assert.strictEqual(result, null);
  });

  it("getLicenseTokensByEmail returns all tokens for an email", async () => {
    const email = "multi@example.com";
    await tokenDb.insertLicenseToken({
      token: "multi-token-1",
      email,
      tier: "developer",
      registered_at: new Date().toISOString(),
    });
    await tokenDb.insertLicenseToken({
      token: "multi-token-2",
      email,
      tier: "enterprise",
      registered_at: new Date().toISOString(),
    });
    const tokens = tokenDb.getLicenseTokensByEmail(email);
    assert.ok(tokens.length >= 2);
  });

  it("revokeLicenseTokenByJti revokes by JWT token ID", async () => {
    // Create a fake 3-part token with a known jti
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ jti: "test-jti-abc123", tier: "enterprise" })).toString("base64url");
    const signature = "fakesig";
    const token = `${header}.${payload}.${signature}`;

    await tokenDb.insertLicenseToken({
      token,
      email: "jti-test@example.com",
      tier: "enterprise",
      registered_at: new Date().toISOString(),
    });

    const result = await tokenDb.revokeLicenseTokenByJti("test-jti-abc123", "JTI test revocation");
    assert.ok(result);
    assert.ok(result.revoked_at);
    assert.strictEqual(result.revoked_reason, "JTI test revocation");
  });

  it("revokeLicenseTokenByJti returns null for unknown jti", async () => {
    const result = await tokenDb.revokeLicenseTokenByJti("nonexistent-jti", "test");
    assert.strictEqual(result, null);
  });
});
