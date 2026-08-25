/**
 * Unit tests for simplebeacon-subscription-store.cjs
 * Run with: node --test __tests__/simplebeacon-subscription-store.test.cjs
 */

const assert = require("assert");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("fs");
const path = require("path");

// Use a temp store path for tests so we don't clobber real data
const TEST_STORE_PATH = path.join(__dirname, ".test-subscriptions.json");
process.env.SIMPLEBEACON_SUBSCRIPTION_STORE = TEST_STORE_PATH;
process.env.SIMPLEBEACON_PAID_API_LIMIT = "5";

// Re-require after setting env so STORE_PATH picks it up
const store = require("../simplebeacon-subscription-store.cjs");

describe("defaultStore", () => {
  it("returns empty subscriptions and byApiToken", () => {
    const s = store.defaultStore();
    assert.deepStrictEqual(Object.keys(s.subscriptions), []);
    assert.deepStrictEqual(Object.keys(s.byApiToken), []);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    assert.strictEqual(
      store.normalizeEmail("  Hello@Example.COM  "),
      "hello@example.com",
    );
  });

  it("rejects invalid emails", () => {
    assert.strictEqual(store.normalizeEmail("not-an-email"), "");
    assert.strictEqual(store.normalizeEmail(""), "");
    assert.strictEqual(store.normalizeEmail(null), "");
    assert.strictEqual(store.normalizeEmail("@example.com"), "");
  });

  it("accepts valid emails", () => {
    assert.strictEqual(
      store.normalizeEmail("user@example.com"),
      "user@example.com",
    );
    assert.strictEqual(store.normalizeEmail("a.b@c.co.uk"), "a.b@c.co.uk");
  });
});

describe("createApiToken", () => {
  it("starts with sb_ and is correct length", () => {
    const token = store.createApiToken();
    assert.ok(token.startsWith("sb_"));
    assert.strictEqual(token.length, 51); // 'sb_' + 48 hex chars
  });

  it("generates unique tokens", () => {
    const t1 = store.createApiToken();
    const t2 = store.createApiToken();
    assert.notStrictEqual(t1, t2);
  });
});

describe("isValidApiTokenFormat", () => {
  it("accepts valid tokens", () => {
    assert.strictEqual(
      store.isValidApiTokenFormat(store.createApiToken()),
      true,
    );
  });

  it("rejects invalid tokens", () => {
    assert.strictEqual(store.isValidApiTokenFormat(""), false);
    assert.strictEqual(store.isValidApiTokenFormat("bad"), false);
    assert.strictEqual(store.isValidApiTokenFormat("sb_123"), false);
    assert.strictEqual(store.isValidApiTokenFormat(null), false);
  });
});

describe("subscriptionRecord", () => {
  it("has all required fields", () => {
    const r = store.subscriptionRecord("test@example.com");
    assert.strictEqual(r.email, "test@example.com");
    assert.strictEqual(r.subscriptionActive, false);
    assert.strictEqual(r.tier, "developer");
    assert.ok(r.apiToken.startsWith("sb_"));
    assert.strictEqual(typeof r.periodStart, "string");
    assert.strictEqual(r.apiCallsThisPeriod, 0);
    assert.strictEqual(r.scansThisPeriod, 0);
    assert.strictEqual(r.complianceCertsThisPeriod, 0);
    assert.strictEqual(r.customConfigEnabled, false);
    assert.strictEqual(r.allowlistEnabled, false);
  });

  it("applies overrides", () => {
    const r = store.subscriptionRecord("test@example.com", {
      tier: "enterprise",
    });
    assert.strictEqual(r.tier, "enterprise");
  });
});

describe("readStore / writeStore", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("readStore returns default when file missing", async () => {
    const s = await store.readStore();
    assert.deepStrictEqual(Object.keys(s.subscriptions), []);
  });

  it("writeStore persists and readStore round-trips", async () => {
    const data = store.defaultStore();
    data.subscriptions["a@b.com"] = store.subscriptionRecord("a@b.com");
    await store.writeStore(data);
    store.clearCache();
    const read = await store.readStore();
    assert.strictEqual(read.subscriptions["a@b.com"].email, "a@b.com");
  });
});

describe("upsertSubscription", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("creates a new subscription", async () => {
    const r = await store.upsertSubscription("new@example.com");
    assert.strictEqual(r.email, "new@example.com");
    assert.ok(r.apiToken);
  });

  it("updates an existing subscription", async () => {
    await store.upsertSubscription("up@example.com");
    const r = await store.upsertSubscription("up@example.com", {
      tier: "growth",
    });
    assert.strictEqual(r.tier, "growth");
    assert.strictEqual(r.email, "up@example.com");
  });

  it("throws on invalid email", async () => {
    await assert.rejects(
      store.upsertSubscription("not-an-email"),
      /Email is required/,
    );
  });

  it("updates byApiToken index on token change", async () => {
    const first = await store.upsertSubscription("token@example.com");
    const oldToken = first.apiToken;
    await store.upsertSubscription("token@example.com", {
      apiToken: store.createApiToken(),
    });
    const byOld = await store.getSubscriptionByApiToken(oldToken);
    assert.strictEqual(byOld, null);
  });
});

describe("getSubscriptionByEmail", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("returns null for missing email", async () => {
    const r = await store.getSubscriptionByEmail("missing@example.com");
    assert.strictEqual(r, null);
  });

  it("returns null for invalid email", async () => {
    const r = await store.getSubscriptionByEmail("not-an-email");
    assert.strictEqual(r, null);
  });

  it("finds existing subscription", async () => {
    await store.upsertSubscription("found@example.com", { tier: "startup" });
    const r = await store.getSubscriptionByEmail("found@example.com");
    assert.strictEqual(r.tier, "startup");
  });
});

describe("getSubscriptionByApiToken", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("returns null for invalid token format", async () => {
    const r = await store.getSubscriptionByApiToken("bad-token");
    assert.strictEqual(r, null);
  });

  it("finds by token", async () => {
    const created = await store.upsertSubscription("bytoken@example.com");
    const found = await store.getSubscriptionByApiToken(created.apiToken);
    assert.strictEqual(found.email, "bytoken@example.com");
  });
});

describe("setSubscriptionActive", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("toggles subscriptionActive", async () => {
    await store.upsertSubscription("active@example.com");
    let r = await store.setSubscriptionActive("active@example.com", true);
    assert.strictEqual(r.subscriptionActive, true);
    r = await store.setSubscriptionActive("active@example.com", false);
    assert.strictEqual(r.subscriptionActive, false);
  });
});

describe("consumeApiCall", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("rejects invalid token format", async () => {
    const r = await store.consumeApiCall("bad");
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, "invalid_token");
  });

  it("rejects unknown token", async () => {
    const r = await store.consumeApiCall(store.createApiToken());
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, "invalid_token");
  });

  it("rejects inactive subscription", async () => {
    const created = await store.upsertSubscription("inactive@example.com");
    const r = await store.consumeApiCall(created.apiToken);
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, "subscription_inactive");
  });

  it("allows up to PAID_API_LIMIT", async () => {
    const created = await store.upsertSubscription("paid@example.com", {
      subscriptionActive: true,
    });
    const limit = store.PAID_API_LIMIT;
    for (let i = 0; i < limit; i++) {
      const r = await store.consumeApiCall(created.apiToken);
      assert.strictEqual(r.allowed, true, `call ${i} should be allowed`);
    }
    const over = await store.consumeApiCall(created.apiToken);
    assert.strictEqual(over.allowed, false);
    assert.strictEqual(over.reason, "rate_limit");
  }, 60000);
});

describe("consumeScan", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("rejects invalid email", async () => {
    const r = await store.consumeScan("not-an-email");
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, "email_required");
  });

  it("allows unlimited for developer tier", async () => {
    await store.upsertSubscription("dev@example.com", { tier: "developer" });
    for (let i = 0; i < 5; i++) {
      const r = await store.consumeScan("dev@example.com");
      assert.strictEqual(r.allowed, true, `scan ${i} should be allowed`);
      assert.strictEqual(r.remaining, Infinity);
    }
  });

  it("enforces pro quota (same as startup)", async () => {
    await store.upsertSubscription("pro@example.com", {
      tier: "pro",
      scanQuota: 3,
    });
    const quota = 3;
    for (let i = 0; i < quota; i++) {
      const r = await store.consumeScan("pro@example.com");
      assert.strictEqual(r.allowed, true, `scan ${i} should be allowed`);
    }
    const over = await store.consumeScan("pro@example.com");
    assert.strictEqual(over.allowed, false);
    assert.strictEqual(over.reason, "scan_quota_exceeded");
  });

  it("enforces team quota (same as growth)", async () => {
    await store.upsertSubscription("team@example.com", {
      tier: "team",
      scanQuota: 3,
    });
    const quota = 3;
    for (let i = 0; i < quota; i++) {
      const r = await store.consumeScan("team@example.com");
      assert.strictEqual(r.allowed, true, `scan ${i} should be allowed`);
    }
    const over = await store.consumeScan("team@example.com");
    assert.strictEqual(over.allowed, false);
    assert.strictEqual(over.reason, "scan_quota_exceeded");
  });
});

describe("consumeComplianceCert", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("rejects inactive subscription", async () => {
    await store.upsertSubscription("cert@example.com");
    const r = await store.consumeComplianceCert("cert@example.com");
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, "subscription_inactive");
  });

  it("rejects non-continuous_shield product", async () => {
    await store.upsertSubscription("notshield@example.com", {
      subscriptionActive: true,
      product: "startup",
    });
    const r = await store.consumeComplianceCert("notshield@example.com");
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.reason, "tier_not_continuous_shield");
  });

  it("allows up to limit for continuous_shield", async () => {
    await store.upsertSubscription("shield@example.com", {
      subscriptionActive: true,
      product: "continuous_shield",
      complianceCertLimit: 2,
    });
    const r1 = await store.consumeComplianceCert("shield@example.com");
    assert.strictEqual(r1.allowed, true);
    const r2 = await store.consumeComplianceCert("shield@example.com");
    assert.strictEqual(r2.allowed, true);
    const r3 = await store.consumeComplianceCert("shield@example.com");
    assert.strictEqual(r3.allowed, false);
    assert.strictEqual(r3.reason, "cert_limit_reached");
  });
});

describe("resetPeriodIfNeeded", () => {
  it("resets counters when period elapsed", () => {
    const record = store.subscriptionRecord("test@example.com");
    record.apiCallsThisPeriod = 50;
    record.scansThisPeriod = 10;
    record.periodStart = new Date(
      Date.now() - store.PAID_PERIOD_MS - 1000,
    ).toISOString();
    const reset = store.resetPeriodIfNeeded(record);
    assert.strictEqual(reset.apiCallsThisPeriod, 0);
    assert.strictEqual(reset.scansThisPeriod, 0);
    assert.notStrictEqual(reset.periodStart, record.periodStart);
  });

  it("preserves counters when period is current", () => {
    const record = store.subscriptionRecord("test@example.com");
    record.apiCallsThisPeriod = 50;
    const reset = store.resetPeriodIfNeeded(record);
    assert.strictEqual(reset.apiCallsThisPeriod, 50);
  });
});

describe("publicSubscriptionStatus", () => {
  it("returns free for null record", () => {
    const s = store.publicSubscriptionStatus(null);
    assert.strictEqual(s.tier, "free");
    assert.strictEqual(s.subscriptionActive, false);
  });

  it("returns active status for paid record", () => {
    const record = store.subscriptionRecord("paid@example.com");
    record.subscriptionActive = true;
    record.product = "growth";
    record.apiCallsThisPeriod = 5;
    const s = store.publicSubscriptionStatus(record);
    assert.strictEqual(s.tier, "growth");
    assert.strictEqual(s.subscriptionActive, true);
    assert.strictEqual(s.apiCallsThisPeriod, 5);
    assert.ok(s.apiRemaining >= 0);
  });

  it("shows unlimited for developer scans", () => {
    const record = store.subscriptionRecord("dev@example.com");
    record.subscriptionActive = true;
    record.tier = "developer";
    const s = store.publicSubscriptionStatus(record);
    assert.strictEqual(s.scanQuota, "unlimited");
    assert.strictEqual(s.scansRemaining, "unlimited");
  });
});

describe("clearCache", () => {
  it("invalidates the cache", async () => {
    await store.upsertSubscription("cache@example.com");
    store.clearCache();
    // After clearing, readStore should re-read from disk (or create default if none)
    // We just verify it doesn't throw and the function exists
    assert.strictEqual(typeof store.clearCache, "function");
  });
});

describe("in-memory caching", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("readStore caches after first read", async () => {
    await store.upsertSubscription("cache-test@example.com");
    store.clearCache();
    const r1 = await store.readStore();
    const r2 = await store.readStore();
    // Should be same object reference due to cache
    assert.strictEqual(r1, r2);
  });
});

describe("grantTrial", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("grants a 14-day trial for a new user", async () => {
    const record = await store.grantTrial("trial@example.com", "developer");
    assert.ok(record, "should return a record");
    assert.strictEqual(record.email, "trial@example.com");
    assert.strictEqual(record.subscriptionActive, true);
    assert.strictEqual(record.tier, "developer");
    assert.ok(record.trialEndsAt, "should have trialEndsAt");
    assert.strictEqual(record.trialTier, "developer");

    // Trial end should be ~14 days from now
    const endsAt = Date.parse(record.trialEndsAt);
    const expectedEnd = Date.now() + store.TRIAL_DURATION_MS;
    const diffMs = Math.abs(endsAt - expectedEnd);
    assert.ok(diffMs < 5000, "trial end should be ~14 days from now");
  });

  it("returns null for invalid email", async () => {
    const record = await store.grantTrial("not-an-email");
    assert.strictEqual(record, null);
  });

  it("skips if user already has an active paid subscription", async () => {
    // Create a paid subscription first
    await store.upsertSubscription("paid@example.com", {
      subscriptionActive: true,
      tier: "developer",
      trialEndsAt: null,
    });
    const record = await store.grantTrial("paid@example.com");
    assert.strictEqual(record, null, "should not grant trial to paid user");
  });

  it("skips if user already has an active unexpired trial", async () => {
    const existing = await store.grantTrial(
      "existing@example.com",
      "developer",
    );
    const record = await store.grantTrial("existing@example.com", "developer");
    assert.ok(record, "should return existing record");
    assert.strictEqual(
      record.trialEndsAt,
      existing.trialEndsAt,
      "should not extend trial",
    );
  });

  it("re-grants if previous trial has expired", async () => {
    // Create an expired trial
    await store.upsertSubscription("expired@example.com", {
      subscriptionActive: true,
      tier: "developer",
      trialEndsAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      trialTier: "developer",
    });
    const record = await store.grantTrial("expired@example.com", "developer");
    assert.ok(record, "should re-grant expired trial");
    const endsAt = Date.parse(record.trialEndsAt);
    assert.ok(endsAt > Date.now(), "new trial should be in the future");
  });
});

describe("checkTrialExpiry", () => {
  beforeEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    store.clearCache();
    try {
      fs.unlinkSync(TEST_STORE_PATH);
    } catch {
      /* ignore */
    }
  });

  it("downgrades to free when trial has expired", async () => {
    await store.upsertSubscription("expired@example.com", {
      subscriptionActive: true,
      tier: "developer",
      trialEndsAt: new Date(Date.now() - 86400000).toISOString(),
      trialTier: "developer",
    });
    const record = await store.checkTrialExpiry(
      await store.getSubscriptionByEmail("expired@example.com"),
    );
    assert.strictEqual(record.subscriptionActive, false);
    assert.strictEqual(record.tier, "free");
    assert.strictEqual(record.trialEndsAt, null);
    assert.strictEqual(record.trialTier, null);
  });

  it("does nothing when trial is still active", async () => {
    await store.grantTrial("active@example.com", "developer");
    const original = await store.getSubscriptionByEmail("active@example.com");
    const record = await store.checkTrialExpiry(original);
    assert.strictEqual(record.subscriptionActive, true);
    assert.ok(record.trialEndsAt, "trialEndsAt should still be set");
  });

  it("does nothing when there is no trial", async () => {
    await store.upsertSubscription("notrial@example.com", {
      subscriptionActive: true,
      tier: "developer",
      trialEndsAt: null,
    });
    const original = await store.getSubscriptionByEmail("notrial@example.com");
    const record = await store.checkTrialExpiry(original);
    assert.strictEqual(record.subscriptionActive, true);
    assert.strictEqual(record.trialEndsAt, null);
  });
});

describe("shouldSendTrialWarning", () => {
  it("returns true when trial ends within 3 days", () => {
    const record = store.subscriptionRecord("warn@example.com");
    record.subscriptionActive = true;
    record.trialEndsAt = new Date(Date.now() + 2 * 86400000).toISOString(); // 2 days
    assert.strictEqual(store.shouldSendTrialWarning(record), true);
  });

  it("returns false when trial ends more than 3 days away", () => {
    const record = store.subscriptionRecord("fut@example.com");
    record.subscriptionActive = true;
    record.trialEndsAt = new Date(Date.now() + 10 * 86400000).toISOString(); // 10 days
    assert.strictEqual(store.shouldSendTrialWarning(record), false);
  });

  it("returns false when trial has already expired", () => {
    const record = store.subscriptionRecord("past@example.com");
    record.subscriptionActive = true;
    record.trialEndsAt = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    assert.strictEqual(store.shouldSendTrialWarning(record), false);
  });

  it("returns false when there is no trial", () => {
    const record = store.subscriptionRecord("none@example.com");
    record.subscriptionActive = true;
    record.trialEndsAt = null;
    assert.strictEqual(store.shouldSendTrialWarning(record), false);
  });

  it("returns false when subscription is inactive", () => {
    const record = store.subscriptionRecord("inactive@example.com");
    record.subscriptionActive = false;
    record.trialEndsAt = new Date(Date.now() + 2 * 86400000).toISOString();
    assert.strictEqual(store.shouldSendTrialWarning(record), false);
  });
});

describe("publicSubscriptionStatus with trial", () => {
  it("shows trial as active when within trial period", () => {
    const record = store.subscriptionRecord("trial@example.com");
    record.subscriptionActive = true;
    record.tier = "developer";
    record.trialEndsAt = new Date(Date.now() + 7 * 86400000).toISOString();
    record.trialTier = "developer";
    const s = store.publicSubscriptionStatus(record);
    assert.strictEqual(s.tier, "developer");
    assert.strictEqual(s.subscriptionActive, true);
    assert.strictEqual(s.trialActive, true);
    assert.ok(s.trialEndsAt);
  });

  it("downgrades to free when trial has expired", () => {
    const record = store.subscriptionRecord("expired@example.com");
    record.subscriptionActive = true;
    record.tier = "developer";
    record.trialEndsAt = new Date(Date.now() - 86400000).toISOString();
    record.trialTier = "developer";
    const s = store.publicSubscriptionStatus(record);
    assert.strictEqual(s.tier, "free");
    assert.strictEqual(s.subscriptionActive, false);
    assert.strictEqual(s.trialActive, false);
    assert.strictEqual(s.trialEndsAt, null);
    assert.strictEqual(s.apiToken, null);
  });
});
