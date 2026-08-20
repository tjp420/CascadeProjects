const {
  generateDeviceFingerprint,
  trustDevice,
  verifyDeviceTrust,
  deviceTrust,
} = require("../../lib/auth/device-service.cjs");

describe("device-service", () => {
  beforeEach(() => {
    deviceTrust.clear();
  });

  describe("generateDeviceFingerprint", () => {
    test("returns consistent hash for same inputs", () => {
      const req = { headers: { "user-agent": "Mozilla/5.0" }, ip: "127.0.0.1" };
      const fp1 = generateDeviceFingerprint(req);
      const fp2 = generateDeviceFingerprint(req);
      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(64); // sha256 hex
    });

    test("returns different hash for different inputs", () => {
      const req1 = { headers: { "user-agent": "A" }, ip: "1.1.1.1" };
      const req2 = { headers: { "user-agent": "B" }, ip: "1.1.1.1" };
      expect(generateDeviceFingerprint(req1)).not.toBe(
        generateDeviceFingerprint(req2),
      );
    });

    test("handles missing fields", () => {
      expect(generateDeviceFingerprint({})).toBeTruthy();
      expect(generateDeviceFingerprint(null)).toBe("");
    });
  });

  describe("trustDevice", () => {
    test("stores trusted device", () => {
      trustDevice("user1", "fp1");
      const key = "user1:fp1";
      expect(deviceTrust.has(key)).toBe(true);
      expect(deviceTrust.get(key).trusted).toBe(true);
    });

    test("ignores invalid input", () => {
      trustDevice(null, "fp1");
      trustDevice("user1", null);
      expect(deviceTrust.size).toBe(0);
    });
  });

  describe("verifyDeviceTrust middleware", () => {
    const mockRes = () => ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    });

    test("allows when device is trusted for gold user", () => {
      const req = {
        headers: { "user-agent": "A" },
        ip: "1.1.1.1",
        user: { id: "u1", trustLevel: "gold" },
      };
      const fp = generateDeviceFingerprint(req);
      trustDevice("u1", fp);
      const res = mockRes();
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.device.trusted).toBe(true);
    });

    test("blocks gold user with untrusted device", () => {
      const req = {
        headers: { "user-agent": "B" },
        ip: "2.2.2.2",
        user: { id: "u2", trustLevel: "gold" },
      };
      const res = mockRes();
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("allows silver user even with untrusted device", () => {
      const req = {
        headers: { "user-agent": "C" },
        ip: "3.3.3.3",
        user: { id: "u3", trustLevel: "silver" },
      };
      const res = mockRes();
      const next = jest.fn();
      verifyDeviceTrust(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
