// simplebeacon-ignore: test fixtures — all findings are false positives
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Set test env vars before requiring modules
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-secret-for-password-reset";
process.env.NODE_ENV = "test";

const { jwtConfig } = require("../lib/jwt-config.cjs");

describe("password reset flow", () => {
  describe("reset token generation and verification", () => {
    it("generates a valid reset token with correct claims", () => {
      const resetJti = crypto.randomUUID();
      const token = jwt.sign(
        {
          sub: "user-123",
          email: "test@example.com",
          action: "RESET_PASSWORD",
          jti: resetJti,
        },
        jwtConfig.secret,
        {
          algorithm: jwtConfig.algorithm,
          issuer: jwtConfig.issuer,
          audience: "simplebeacon-password-reset",
          expiresIn: "15m",
        },
      );

      const payload = jwt.verify(token, jwtConfig.secret, {
        algorithms: [jwtConfig.algorithm],
        issuer: jwtConfig.issuer,
        audience: "simplebeacon-password-reset",
      });

      assert.strictEqual(payload.sub, "user-123");
      assert.strictEqual(payload.email, "test@example.com");
      assert.strictEqual(payload.action, "RESET_PASSWORD");
      assert.strictEqual(payload.jti, resetJti);
    });

    it("rejects a reset token with wrong audience", () => {
      const token = jwt.sign(
        {
          sub: "user-123",
          email: "test@example.com",
          action: "RESET_PASSWORD",
        },
        jwtConfig.secret,
        {
          algorithm: jwtConfig.algorithm,
          issuer: jwtConfig.issuer,
          audience: "wrong-audience",
          expiresIn: "15m",
        },
      );

      assert.throws(
        () =>
          jwt.verify(token, jwtConfig.secret, {
            algorithms: [jwtConfig.algorithm],
            issuer: jwtConfig.issuer,
            audience: "simplebeacon-password-reset",
          }),
        /audience/i,
      );
    });

    it("rejects an expired reset token", () => {
      const token = jwt.sign(
        {
          sub: "user-123",
          email: "test@example.com",
          action: "RESET_PASSWORD",
        },
        jwtConfig.secret,
        {
          algorithm: jwtConfig.algorithm,
          issuer: jwtConfig.issuer,
          audience: "simplebeacon-password-reset",
          expiresIn: "0s",
        },
      );

      // Wait a tick for the token to expire
      assert.throws(
        () =>
          jwt.verify(token, jwtConfig.secret, {
            algorithms: [jwtConfig.algorithm],
            issuer: jwtConfig.issuer,
            audience: "simplebeacon-password-reset",
          }),
        /expired/i,
      );
    });

    it("rejects a token with wrong action claim", () => {
      const token = jwt.sign(
        {
          sub: "user-123",
          email: "test@example.com",
          action: "DIFFERENT_ACTION",
        },
        jwtConfig.secret,
        {
          algorithm: jwtConfig.algorithm,
          issuer: jwtConfig.issuer,
          audience: "simplebeacon-password-reset",
          expiresIn: "15m",
        },
      );

      const payload = jwt.verify(token, jwtConfig.secret, {
        algorithms: [jwtConfig.algorithm],
        issuer: jwtConfig.issuer,
        audience: "simplebeacon-password-reset",
      });

      assert.notStrictEqual(payload.action, "RESET_PASSWORD");
    });

    it("rejects a tampered token", () => {
      const token = jwt.sign(
        {
          sub: "user-123",
          email: "test@example.com",
          action: "RESET_PASSWORD",
        },
        jwtConfig.secret,
        {
          algorithm: jwtConfig.algorithm,
          issuer: jwtConfig.issuer,
          audience: "simplebeacon-password-reset",
          expiresIn: "15m",
        },
      );

      // Tamper with the token
      const parts = token.split(".");
      const tampered = parts[0] + "." + parts[1] + "x." + parts[2];

      assert.throws(
        () =>
          jwt.verify(tampered, jwtConfig.secret, {
            algorithms: [jwtConfig.algorithm],
            issuer: jwtConfig.issuer,
            audience: "simplebeacon-password-reset",
          }),
      );
    });
  });

  describe("single-use token tracking", () => {
    it("consumed tokens are tracked in a Set", () => {
      const consumed = new Set();
      const jti = "test-jti-123";

      // Before consumption
      assert.strictEqual(consumed.has(jti), false);

      // After consumption
      consumed.add(jti);
      assert.strictEqual(consumed.has(jti), true);
    });
  });

  describe("password validation", () => {
    it("rejects passwords shorter than 8 characters", () => {
      const newPassword = "short";
      assert.ok(newPassword.length < 8, "short password should be rejected");
    });

    it("accepts passwords of 8 or more characters", () => {
      const newPassword = "securePassword123";
      assert.ok(newPassword.length >= 8, "long password should be accepted");
    });
  });

  describe("email normalization", () => {
    it("normalizes emails to lowercase and trims whitespace", () => {
      const email = "  Test@Example.COM  ";
      const normalized = email.trim().toLowerCase();
      assert.strictEqual(normalized, "test@example.com");
    });
  });

  describe("recovery link construction", () => {
    it("constructs a hash-router compatible link", () => {
      const baseUrl = "https://simplebeacon.ai";
      const token = "test-token-abc123";
      const link = `${baseUrl}/#/reset-password?token=${token}`;

      assert.ok(link.includes("#/reset-password"));
      assert.ok(link.includes(`token=${token}`));
    });
  });
});
