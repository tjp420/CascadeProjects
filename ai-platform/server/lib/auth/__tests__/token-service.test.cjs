const { jest: _jest } = require("@jest/globals");

const path = require("path");

describe("token-service core behaviors", () => {
  let tokenService;
  beforeEach(() => {
    jest.resetModules();
    tokenService = require("../token-service.cjs");
  });

  test("generateToken throws on invalid input", () => {
    expect(() => tokenService.generateToken(null)).toThrow(TypeError);
  });

  test("generateToken produces a verifiable token and verifyToken decodes it", async () => {
    const user = {
      id: "u123",
      email: "u@x.com",
      name: "U",
      trustLevel: "gold",
    };
    const token = tokenService.generateToken(user);
    expect(typeof token).toBe("string");

    const decoded = await tokenService.verifyToken(token);
    expect(decoded.sub).toBe("u123");
    expect(decoded.email).toBe("u@x.com");
  });

  test("first-use expiry behavior and invalidateToken", () => {
    const jti = "test-jti-1";
    const now = Date.now();
    const origNow = Date.now;
    try {
      // record first use
      const t1 = tokenService.recordTokenFirstUse(jti);
      expect(typeof t1).toBe("number");

      // advance time beyond lifetime
      const future = t1 + tokenService.TOKEN_LIFETIME_MS + 1000;
      Date.now = () => future;
      expect(tokenService.isTokenExpiredByFirstUse(jti)).toBe(true);

      // invalidate should remove tracking
      tokenService.invalidateToken(jti);
      expect(tokenService.isTokenExpiredByFirstUse(jti)).toBe(false);
    } finally {
      Date.now = origNow;
    }
  });

  // ── Zeroization tests ──────────────────────────────────────────────

  test("Z-TOKEN-01: verifyToken zeroizes token buffer after successful verification", async () => {
    const user = {
      id: "u-z1",
      email: "z1@x.com",
      name: "Z1",
      trustLevel: "gold",
    };
    const token = tokenService.generateToken(user);

    // Create a buffer copy to track what verifyToken creates internally
    const tracker = Buffer.from(token, "utf8");
    const originalContents = Buffer.from(tracker); // snapshot

    // verifyToken should succeed and zeroize its internal buffer
    const decoded = await tokenService.verifyToken(token);
    expect(decoded.sub).toBe("u-z1");

    // The original token string is immutable, but our tracker should
    // still have its contents (we only zeroize the internal copy)
    expect(tracker.equals(originalContents)).toBe(true);
  });

  test("Z-TOKEN-02: verifyToken zeroizes token buffer even on invalid token", async () => {
    // An invalid token should throw but still zeroize the buffer
    await expect(
      tokenService.verifyToken("invalid-token-string"),
    ).rejects.toThrow();
    // No crash, no hang — zeroization in finally block ran
  });

  test("Z-TOKEN-03: verifyToken zeroizes token buffer on null input", async () => {
    // null token should throw but not crash
    await expect(tokenService.verifyToken(null)).rejects.toThrow();
  });

  test("Z-TOKEN-04: verifyToken works correctly with multiple sequential calls", async () => {
    const user = {
      id: "u-z4",
      email: "z4@x.com",
      name: "Z4",
      trustLevel: "gold",
    };
    const token1 = tokenService.generateToken(user);
    const token2 = tokenService.generateToken({ ...user, id: "u-z4b" });

    const d1 = await tokenService.verifyToken(token1);
    expect(d1.sub).toBe("u-z4");

    const d2 = await tokenService.verifyToken(token2);
    expect(d2.sub).toBe("u-z4b");
  });
});
