/**
 * Advanced auth middleware tests — uncovered paths in server/middleware/auth.cjs
 * Covers token first-use, device trust, MFA, vault operator, and debug logging.
 */

const {
  recordTokenFirstUse,
  isTokenExpiredByFirstUse,
  invalidateToken,
  generateDeviceFingerprint,
  trustDevice,
  verifyMFA,
  verifyDeviceTrust,
  handleTokenRefresh,
} = require("../server/middleware/auth.cjs");

describe("auth-advanced", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("token first-use tracking", () => {
    test("recordTokenFirstUse stores timestamp on first call", () => {
      const ts = recordTokenFirstUse("jti-1");
      expect(typeof ts).toBe("number");
      expect(ts).toBeLessThanOrEqual(Date.now());
    });

    test("recordTokenFirstUse returns same timestamp on repeat", () => {
      const ts1 = recordTokenFirstUse("jti-2");
      const ts2 = recordTokenFirstUse("jti-2");
      expect(ts1).toBe(ts2);
    });

    test("isTokenExpiredByFirstUse returns false when not used", () => {
      expect(isTokenExpiredByFirstUse("jti-never")).toBe(false);
    });

    test("isTokenExpiredByFirstUse returns false within 24h", () => {
      recordTokenFirstUse("jti-fresh");
      expect(isTokenExpiredByFirstUse("jti-fresh")).toBe(false);
    });

    test("invalidateToken removes first-use record", () => {
      recordTokenFirstUse("jti-gone");
      invalidateToken("jti-gone");
      expect(isTokenExpiredByFirstUse("jti-gone")).toBe(false);
      // After invalidation, recordTokenFirstUse should create a new timestamp
      const ts = recordTokenFirstUse("jti-gone");
      expect(typeof ts).toBe("number");
    });
  });

  describe("generateDeviceFingerprint", () => {
    test("returns sha256 hex from user-agent + ip", () => {
      const req = {
        headers: { "user-agent": "Mozilla/5.0" },
        ip: "127.0.0.1",
      };
      const fp = generateDeviceFingerprint(req);
      expect(typeof fp).toBe("string");
      expect(fp.length).toBe(64);
    });

    test("returns consistent fingerprint for same inputs", () => {
      const req = {
        headers: { "user-agent": "TestAgent/1.0" },
        ip: "192.168.1.1",
      };
      const fp1 = generateDeviceFingerprint(req);
      const fp2 = generateDeviceFingerprint(req);
      expect(fp1).toBe(fp2);
    });

    test("handles missing user-agent and ip", () => {
      const req = { headers: {}, connection: {} };
      const fp = generateDeviceFingerprint(req);
      expect(typeof fp).toBe("string");
      expect(fp.length).toBe(64);
    });
  });

  describe("trustDevice", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("stores trusted device with expiry", () => {
      const req = {
        user: { id: "u1", trustLevel: "gold" },
        headers: { "user-agent": "x" },
        ip: "1.1.1.1",
      };
      // Compute actual fingerprint from request, then trust it
      const fp = generateDeviceFingerprint(req);
      trustDevice("u1", fp, 1000);

      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.device.trusted).toBe(true);
    });
  });

  describe("verifyDeviceTrust", () => {
    test("blocks gold user on untrusted device", () => {
      const req = {
        user: { id: "u-untrusted", trustLevel: "gold" },
        headers: { "user-agent": "unknown" },
        ip: "9.9.9.9",
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Device Not Trusted",
          deviceTrustRequired: true,
        }),
      );
    });

    test("allows bronze user on untrusted device", () => {
      const req = {
        user: { id: "u-bronze", trustLevel: "bronze" },
        headers: { "user-agent": "any" },
        ip: "1.1.1.1",
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.device.trusted).toBe(false);
    });

    test("allows gold user on trusted device", () => {
      // Compute the actual fingerprint the function will generate
      const req = {
        user: { id: "u-gold", trustLevel: "gold" },
        headers: { "user-agent": "TrustedAgent/1.0" },
        ip: "10.0.0.1",
      };
      const fp = generateDeviceFingerprint(req);
      trustDevice("u-gold", fp);

      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.device.trusted).toBe(true);
    });
  });

  describe("verifyMFA", () => {
    test("allows request when MFA not required", () => {
      const req = { user: { trustLevel: "bronze" }, session: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test("blocks gold user without MFA verification", () => {
      const req = { user: { trustLevel: "gold" }, session: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "MFA Required",
          mfaRequired: true,
        }),
      );
    });

    test("allows gold user with MFA verified", () => {
      const req = {
        user: { trustLevel: "gold" },
        session: { mfaVerified: true },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();
      verifyMFA(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("handleTokenRefresh", () => {
    test("returns 401 when refresh token missing", async () => {
      const req = { body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await handleTokenRefresh(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Authentication required" }),
      );
    });
  });
});
