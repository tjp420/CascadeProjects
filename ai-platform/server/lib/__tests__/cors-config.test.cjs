const { test } = require("node:test");
const assert = require("node:assert");
const {
  resolveCorsOptions,
  isAllowedOrigin,
  resolveAllowedOrigins,
  parseOriginList,
} = require("../cors-config.cjs");

test("parseOriginList splits comma-separated origins", () => {
  assert.deepStrictEqual(parseOriginList("https://a.com,https://b.com"), [
    "https://a.com",
    "https://b.com",
  ]);
  assert.deepStrictEqual(parseOriginList(""), []);
  assert.deepStrictEqual(parseOriginList(null), []);
  assert.deepStrictEqual(parseOriginList(" https://a.com , https://b.com "), [
    "https://a.com",
    "https://b.com",
  ]);
});

test("isAllowedOrigin returns true in non-production", () => {
  const origEnv = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  assert.strictEqual(isAllowedOrigin("https://evil.com"), true);
  assert.strictEqual(isAllowedOrigin("http://localhost:3000"), true);
  assert.strictEqual(isAllowedOrigin(""), true);
  process.env.NODE_ENV = origEnv;
});

test("isAllowedOrigin enforces explicit list in production", () => {
  const origEnv = process.env.NODE_ENV;
  const origAllowed = process.env.ALLOWED_ORIGIN;
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGIN =
    "https://simplebeacon.ai,https://www.simplebeacon.ai";

  assert.strictEqual(isAllowedOrigin("https://simplebeacon.ai"), true);
  assert.strictEqual(isAllowedOrigin("https://www.simplebeacon.ai"), true);
  assert.strictEqual(isAllowedOrigin("https://evil.com"), false);
  assert.strictEqual(isAllowedOrigin(""), true); // no origin header = allowed

  process.env.NODE_ENV = origEnv;
  if (origAllowed !== undefined) process.env.ALLOWED_ORIGIN = origAllowed;
  else delete process.env.ALLOWED_ORIGIN;
});

test("isAllowedOrigin allows pages.dev preview origins in production", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.strictEqual(
    isAllowedOrigin("https://abc123.simplebeacon.pages.dev"),
    true,
  );
  assert.strictEqual(isAllowedOrigin("https://simplebeacon.pages.dev"), true);
  process.env.NODE_ENV = origEnv;
});

test("isAllowedOrigin allows onrender.com origins in production", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.strictEqual(
    isAllowedOrigin("https://simplebeacon.onrender.com"),
    true,
  );
  process.env.NODE_ENV = origEnv;
});

test("isAllowedOrigin rejects wildcard in production even if configured", () => {
  const origEnv = process.env.NODE_ENV;
  const origAllowed = process.env.ALLOWED_ORIGIN;
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGIN = "*";
  assert.strictEqual(isAllowedOrigin("https://evil.com"), false);
  process.env.NODE_ENV = origEnv;
  if (origAllowed !== undefined) process.env.ALLOWED_ORIGIN = origAllowed;
  else delete process.env.ALLOWED_ORIGIN;
});

test("isAllowedOrigin includes PUBLIC_URL in production", () => {
  const origEnv = process.env.NODE_ENV;
  const origAllowed = process.env.ALLOWED_ORIGIN;
  const origPublicUrl = process.env.PUBLIC_URL;
  process.env.NODE_ENV = "production";
  delete process.env.ALLOWED_ORIGIN;
  process.env.PUBLIC_URL = "https://custom-domain.com";
  assert.strictEqual(isAllowedOrigin("https://custom-domain.com"), true);
  process.env.NODE_ENV = origEnv;
  if (origAllowed !== undefined) process.env.ALLOWED_ORIGIN = origAllowed;
  else delete process.env.ALLOWED_ORIGIN;
  if (origPublicUrl !== undefined) process.env.PUBLIC_URL = origPublicUrl;
  else delete process.env.PUBLIC_URL;
});

test("resolveCorsOptions returns valid cors middleware config", () => {
  const opts = resolveCorsOptions();
  assert.strictEqual(typeof opts.origin, "function");
  assert.strictEqual(opts.credentials, true);
  assert.ok(opts.allowedHeaders.includes("Authorization"));
  assert.ok(opts.methods.includes("GET"));
  assert.ok(opts.methods.includes("OPTIONS"));
  assert.strictEqual(opts.maxAge, 86400);
});

test("resolveCorsOptions origin callback works correctly", () => {
  const origEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGIN = "https://simplebeacon.ai";
  const opts = resolveCorsOptions();

  // allowed origin
  opts.origin("https://simplebeacon.ai", (err, result) => {
    assert.strictEqual(err, null);
    assert.strictEqual(result, "https://simplebeacon.ai");
  });

  // disallowed origin
  opts.origin("https://evil.com", (err, result) => {
    assert.strictEqual(err, null);
    assert.strictEqual(result, false);
  });

  // no origin
  opts.origin(undefined, (err, result) => {
    assert.strictEqual(err, null);
    assert.strictEqual(result, true);
  });

  process.env.NODE_ENV = origEnv;
  delete process.env.ALLOWED_ORIGIN;
});

test("resolveAllowedOrigins deduplicates and includes PUBLIC_URL", () => {
  const origAllowed = process.env.ALLOWED_ORIGIN;
  const origPublicUrl = process.env.PUBLIC_URL;
  process.env.ALLOWED_ORIGIN = "https://a.com,https://b.com,https://a.com";
  process.env.PUBLIC_URL = "https://a.com";
  const origins = resolveAllowedOrigins();
  assert.ok(origins.includes("https://a.com"));
  assert.ok(origins.includes("https://b.com"));
  assert.strictEqual(origins.filter((o) => o === "https://a.com").length, 1); // deduped
  if (origAllowed !== undefined) process.env.ALLOWED_ORIGIN = origAllowed;
  else delete process.env.ALLOWED_ORIGIN;
  if (origPublicUrl !== undefined) process.env.PUBLIC_URL = origPublicUrl;
  else delete process.env.PUBLIC_URL;
});
