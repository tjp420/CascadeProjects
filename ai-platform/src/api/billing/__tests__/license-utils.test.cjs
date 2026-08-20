const {
  getAppBaseUrl,
  getStripeClient,
  resolvePriceId,
  isValidPriceId,
  isValidProductKey,
  isValidEmail,
  isValidLicenseTier,
  VALID_LICENSE_TIERS,
  checkoutModeForProduct,
} = require("../license-utils.cjs");

describe("license-utils", () => {
  describe("getAppBaseUrl", () => {
    test("returns env var when set", () => {
      process.env.SIMPLEBEACON_APP_URL = "https://app.example.com/";
      expect(getAppBaseUrl()).toBe("https://app.example.com");
      delete process.env.SIMPLEBEACON_APP_URL;
    });
    test("falls back to localhost", () => {
      delete process.env.SIMPLEBEACON_APP_URL;
      delete process.env.PUBLIC_APP_URL;
      expect(getAppBaseUrl()).toContain("localhost");
    });
  });

  describe("getStripeClient", () => {
    test("returns null when key missing", () => {
      delete process.env.STRIPE_SECRET_KEY;
      expect(getStripeClient()).toBeNull();
    });
  });

  describe("resolvePriceId", () => {
    test("returns null for unknown product", () => {
      expect(resolvePriceId("unknown")).toBeNull();
    });
    test("reads from env for known product", () => {
      process.env.STRIPE_PRICE_ID_INSTANT_REPORT = "price_test_123";
      expect(resolvePriceId("instant_report")).toBe("price_test_123");
      delete process.env.STRIPE_PRICE_ID_INSTANT_REPORT;
    });
  });

  describe("isValidPriceId", () => {
    test("accepts price_ prefix", () => {
      expect(isValidPriceId("price_123")).toBe(true);
    });
    test("rejects non-string", () => {
      expect(isValidPriceId(123)).toBe(false);
    });
  });

  describe("isValidProductKey", () => {
    test("rejects empty string", () => {
      expect(isValidProductKey("")).toBe(false);
    });
  });

  describe("isValidEmail", () => {
    test("accepts valid email", () => {
      expect(isValidEmail("a@b.com")).toBe(true);
    });
    test("rejects invalid email", () => {
      expect(isValidEmail("not-an-email")).toBe(false);
    });
  });

  describe("isValidLicenseTier", () => {
    test("accepts known tier", () => {
      expect(isValidLicenseTier("executive")).toBe(true);
    });
    test("rejects unknown tier", () => {
      expect(isValidLicenseTier("hacker")).toBe(false);
    });
    test("is case-insensitive", () => {
      expect(isValidLicenseTier("EXECUTIVE")).toBe(true);
    });
  });

  describe("VALID_LICENSE_TIERS", () => {
    test("contains executive", () => {
      expect(VALID_LICENSE_TIERS.has("executive")).toBe(true);
    });
  });

  describe("checkoutModeForProduct", () => {
    test("one-time products use payment", () => {
      expect(checkoutModeForProduct("instant_report")).toBe("payment");
      expect(checkoutModeForProduct("executive_clearance")).toBe("payment");
    });
    test("subscriptions use subscription mode", () => {
      expect(checkoutModeForProduct("developer_tier")).toBe("subscription");
    });
  });
});
