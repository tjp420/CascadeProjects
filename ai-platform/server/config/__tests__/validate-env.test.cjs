"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");

describe("validate-env", () => {
  const {
    validateEnvironment,
    isValidStripeSecretKey,
    isValidWebhookSecret,
    REQUIRED_STRIPE_VARS,
  } = require("../validate-env.cjs");

  let savedEnv;
  let savedExit;

  before(() => {
    savedEnv = { ...process.env };
    // Stub process.exit so it doesn't actually kill the test runner
    savedExit = process.exit;
    process.exit = (code) => {
      const err = new Error("process.exit(" + code + ") called");
      err.exitCode = code;
      throw err;
    };
  });

  after(() => {
    for (const k of Object.keys(process.env)) {
      if (!(k in savedEnv)) delete process.env[k];
    }
    Object.assign(process.env, savedEnv);
    process.exit = savedExit;
  });

  function clearStripeEnv() {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.NODE_ENV;
  }

  it("REQUIRED_STRIPE_VARS contains STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET", () => {
    assert.ok(REQUIRED_STRIPE_VARS.includes("STRIPE_SECRET_KEY"));
    assert.ok(REQUIRED_STRIPE_VARS.includes("STRIPE_WEBHOOK_SECRET"));
  });

  it("isValidStripeSecretKey accepts sk_test_ prefix", () => {
    assert.strictEqual(isValidStripeSecretKey("sk_test_abc123"), true);
  });

  it("isValidStripeSecretKey accepts sk_live_ prefix", () => {
    assert.strictEqual(isValidStripeSecretKey("sk_live_abc123"), true);
  });

  it("isValidStripeSecretKey accepts rk_ restricted key prefix", () => {
    assert.strictEqual(isValidStripeSecretKey("rk_live_abc123"), true);
    assert.strictEqual(isValidStripeSecretKey("rk_test_abc123"), true);
  });

  it("isValidStripeSecretKey rejects pk_ prefix (publishable key)", () => {
    assert.strictEqual(isValidStripeSecretKey("pk_test_abc123"), false);
  });

  it("isValidStripeSecretKey rejects empty string", () => {
    assert.strictEqual(isValidStripeSecretKey(""), false);
  });

  it("isValidWebhookSecret accepts whsec_ prefix", () => {
    assert.strictEqual(isValidWebhookSecret("whsec_abc123"), true);
  });

  it("isValidWebhookSecret rejects non-whsec_ prefix", () => {
    assert.strictEqual(isValidWebhookSecret("sec_abc123"), false);
  });

  it("validateEnvironment passes with valid keys (non-fatal mode)", () => {
    clearStripeEnv();
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test123";
    const result = validateEnvironment({ fatal: false });
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.missing.length, 0);
    assert.strictEqual(result.invalid.length, 0);
  });

  it("validateEnvironment reports missing keys", () => {
    clearStripeEnv();
    const result = validateEnvironment({ fatal: false });
    assert.strictEqual(result.passed, false);
    assert.ok(result.missing.includes("STRIPE_SECRET_KEY"));
    assert.ok(result.missing.includes("STRIPE_WEBHOOK_SECRET"));
  });

  it("validateEnvironment reports invalid prefix (pk_ instead of sk_)", () => {
    clearStripeEnv();
    process.env.STRIPE_SECRET_KEY = "pk_test_wrong_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test123";
    const result = validateEnvironment({ fatal: false });
    assert.strictEqual(result.passed, false);
    assert.ok(result.invalid.length > 0);
    assert.ok(
      result.invalid.some(function (m) {
        return m.indexOf("STRIPE_SECRET_KEY") >= 0;
      }),
    );
  });

  it("validateEnvironment reports invalid webhook secret prefix", () => {
    clearStripeEnv();
    process.env.STRIPE_SECRET_KEY = "sk_test_abc123";
    process.env.STRIPE_WEBHOOK_SECRET = "secret_wrong_format";
    const result = validateEnvironment({ fatal: false });
    assert.strictEqual(result.passed, false);
    assert.ok(
      result.invalid.some(function (m) {
        return m.indexOf("STRIPE_WEBHOOK_SECRET") >= 0;
      }),
    );
  });

  it("validateEnvironment calls process.exit(1) in fatal mode on missing keys", () => {
    clearStripeEnv();
    try {
      validateEnvironment({ fatal: true });
      assert.fail("should have thrown via process.exit stub");
    } catch (err) {
      assert.strictEqual(err.exitCode, 1);
    }
  });

  it("validateEnvironment does NOT exit in non-fatal mode on missing keys", () => {
    clearStripeEnv();
    const result = validateEnvironment({ fatal: false });
    assert.strictEqual(result.passed, false);
    // If we reach here, process.exit was not called
    assert.ok(true);
  });

  it("validateEnvironment defaults to non-fatal in non-production NODE_ENV", () => {
    clearStripeEnv();
    process.env.NODE_ENV = "development";
    const result = validateEnvironment();
    assert.strictEqual(result.passed, false);
    // If we reach here, process.exit was not called (non-fatal default)
    assert.ok(true);
  });

  it("validateEnvironment defaults to non-fatal in production NODE_ENV (boot server, billing fails at runtime)", () => {
    clearStripeEnv();
    process.env.NODE_ENV = "production";
    const result = validateEnvironment();
    assert.strictEqual(result.passed, false);
    // Server should boot — non-billing endpoints remain available
    assert.ok(true);
  });

  it("validateEnvironment is fatal when explicitly requested", () => {
    clearStripeEnv();
    process.env.NODE_ENV = "production";
    try {
      validateEnvironment({ fatal: true });
      assert.fail("should have thrown via process.exit stub when fatal=true");
    } catch (err) {
      assert.strictEqual(err.exitCode, 1);
    }
  });
});
