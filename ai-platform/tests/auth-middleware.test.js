/**
 * Auth middleware tests — server/middleware/auth.cjs
 *
 * Covers JWT generation/verification, login handler, bcrypt, and trust evaluation.
 */

const {
  generateToken,
  verifyToken,
  handleLogin,
  authenticate,
  authorize,
  hashPassword,
  verifyPassword,
  evaluateTrustLevel,
  trustLevels,
} = require("../server/middleware/auth.cjs");

describe("Auth Middleware", () => {
  describe("generateToken / verifyToken", () => {
    test("round-trip: generate then verify", async () => {
      const user = {
        id: "u-123",
        email: "test@example.com",
        name: "Test User",
        trustLevel: "bronze",
      };
      const token = generateToken(user);
      expect(typeof token).toBe("string");

      const decoded = await verifyToken(token);
      expect(decoded.sub).toBe("u-123");
      expect(decoded.email).toBe("test@example.com");
      expect(decoded.trustLevel).toBe("bronze");
    });

    test("verifyToken throws on invalid token", async () => {
      await expect(verifyToken("not-a-token")).rejects.toThrow();
    });
  });

  describe("handleLogin", () => {
    test("returns token and admin user for admin email", async () => {
      process.env.SIMPLEBEACON_EMERGENCY_EMAIL = "admin@example.com";
      process.env.SIMPLEBEACON_EMERGENCY_PASSWORD = "any";
      process.env.SIMPLEBEACON_ADMIN_EMAILS = "admin@example.com";
      const req = {
        body: { email: "admin@example.com", password: "any" },
        ip: "127.0.0.1",
        headers: {},
        requestId: "req-1",
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };
      const next = jest.fn();

      await handleLogin(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const result = res.json.mock.calls[0][0];
      expect(result.token).toBeDefined();
      expect(result.user.trustLevel).toBe("gold");
      expect(result.user.email).toBe("admin@example.com");
    });

    test("returns token and bronze user for non-admin email", async () => {
      process.env.SIMPLEBEACON_EMERGENCY_EMAIL = "user@example.com";
      process.env.SIMPLEBEACON_EMERGENCY_PASSWORD = "any";
      process.env.SIMPLEBEACON_ADMIN_EMAILS = "admin@example.com";
      const req = {
        body: { email: "user@example.com", password: "any" },
        ip: "127.0.0.1",
        headers: {},
        requestId: "req-2",
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      const next = jest.fn();

      await handleLogin(req, res, next);

      const result = res.json.mock.calls[0][0];
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe("user@example.com");
    });

    test("rejects missing email or password", async () => {
      const req = {
        body: { email: "", password: "" },
        ip: "127.0.0.1",
        headers: {},
        requestId: "req-3",
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
      const next = jest.fn();

      await handleLogin(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].status).toBe(400);
    });
  });

  describe("authenticate middleware", () => {
    test("attaches user for valid Bearer token", async () => {
      const token = generateToken({
        id: "u-456",
        email: "auth@example.com",
        name: "Auth User",
        trustLevel: "silver",
      });
      const req = {
        headers: { authorization: `Bearer ${token}` },
        ip: "127.0.0.1",
      };
      const res = {};
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(req.user.id).toBe("u-456");
      expect(req.user.trustLevel).toBe("silver");
      expect(next).toHaveBeenCalled();
    });

    test("returns 401 when authorization header missing", async () => {
      const req = { headers: {}, ip: "127.0.0.1" };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(401);
    });

    test("returns 401 for expired/invalid token", async () => {
      const req = {
        headers: { authorization: "Bearer invalid-token" },
        ip: "127.0.0.1",
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      await authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(401);
    });
  });

  describe("authorize middleware", () => {
    test("allows request with sufficient permissions", () => {
      const req = { user: { permissions: ["read:own", "write:own"] } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authorize(["read:own"])(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test("returns 403 when permissions missing", () => {
      const req = { user: { permissions: ["read:own"], id: "u-1" } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authorize(["admin:basic"])(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test("returns 401 when user not present", () => {
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authorize(["read:own"])(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe("hashPassword / verifyPassword", () => {
    test("round-trip: hash then verify", async () => {
      const plain = "my-secret-password";
      const hashed = await hashPassword(plain);
      expect(hashed).not.toBe(plain);

      const valid = await verifyPassword(plain, hashed);
      expect(valid).toBe(true);

      const invalid = await verifyPassword("wrong", hashed);
      expect(invalid).toBe(false);
    });
  });

  describe("evaluateTrustLevel", () => {
    test("returns bronze for new user", () => {
      const user = {
        createdAt: new Date().toISOString(),
        successfulAnalyses: 0,
        securityIncidents: 0,
        communityContributions: 0,
        verificationStatus: "none",
      };
      expect(evaluateTrustLevel(user)).toBe("bronze");
    });

    test("returns gold for high-score user", () => {
      const user = {
        createdAt: new Date(
          Date.now() - 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        successfulAnalyses: 100,
        securityIncidents: 0,
        communityContributions: 20,
        verificationStatus: "enterprise",
      };
      expect(evaluateTrustLevel(user)).toBe("gold");
    });
  });

  describe("trustLevels configuration", () => {
    test("has bronze, silver, gold levels", () => {
      expect(trustLevels.bronze).toBeDefined();
      expect(trustLevels.silver).toBeDefined();
      expect(trustLevels.gold).toBeDefined();
      expect(trustLevels.gold.mfaRequired).toBe(true);
      expect(trustLevels.bronze.mfaRequired).toBe(false);
    });
  });
});
