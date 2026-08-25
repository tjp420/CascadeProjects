const {
  hashPassword,
  verifyPassword,
} = require("../../lib/auth/password-service.cjs");

describe("password-service", () => {
  describe("hashPassword", () => {
    test("hashes a password", async () => {
      const hash = await hashPassword("mySecret123");
      expect(hash).toBeTruthy();
      expect(hash.startsWith("$2")).toBe(true);
    });

    test("throws for empty string", async () => {
      await expect(hashPassword("")).rejects.toThrow(TypeError);
    });

    test("throws for non-string", async () => {
      await expect(hashPassword(123)).rejects.toThrow(TypeError);
    });
  });

  describe("verifyPassword", () => {
    test("verifies correct password", async () => {
      const hash = await hashPassword("correct");
      const valid = await verifyPassword("correct", hash);
      expect(valid).toBe(true);
    });

    test("rejects wrong password", async () => {
      const hash = await hashPassword("correct");
      const valid = await verifyPassword("wrong", hash);
      expect(valid).toBe(false);
    });

    test("throws for non-string args", async () => {
      await expect(verifyPassword(1, 2)).rejects.toThrow(TypeError);
    });
  });
});
