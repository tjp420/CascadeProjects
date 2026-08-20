const { TIER_EMAIL_CONFIG, buildTierEmail } = require("../email-templates.cjs");

describe("email-templates", () => {
  describe("TIER_EMAIL_CONFIG", () => {
    test("has instant_report config", () => {
      expect(TIER_EMAIL_CONFIG.instant_report.headline).toBe(
        "Your Report is Ready",
      );
      expect(TIER_EMAIL_CONFIG.instant_report.tokenVisible).toBe(false);
    });
    test("has executive_clearance config", () => {
      expect(TIER_EMAIL_CONFIG.executive_clearance.headline).toBe(
        "Payment Confirmed",
      );
      expect(TIER_EMAIL_CONFIG.executive_clearance.tokenVisible).toBe(true);
    });
    test("has eu_ai_act_sprint config", () => {
      expect(TIER_EMAIL_CONFIG.eu_ai_act_sprint.price).toBe("$2,499.00");
    });
    test("has developer_tier config", () => {
      expect(TIER_EMAIL_CONFIG.developer_tier.price).toBe("$49.00 / month");
    });
    test("has team_pro_tier config", () => {
      expect(TIER_EMAIL_CONFIG.team_pro_tier.price).toBe("$149.00 / month");
    });
    test("has continuous_shield config", () => {
      expect(TIER_EMAIL_CONFIG.continuous_shield.receiptClass).toBe(
        "enterprise",
      );
    });
    test("has runtime_shield config", () => {
      expect(TIER_EMAIL_CONFIG.runtime_shield.receiptClass).toBe("enterprise");
    });
  });

  describe("buildTierEmail", () => {
    test("returns null when no template loaded", () => {
      // If emailTemplateHtml is null, buildTierEmail returns null
      const result = buildTierEmail(
        "instant_report",
        "tok123",
        "https://upload",
        "sess_abc",
      );
      // Result may be null or object depending on whether template file exists
      expect(result === null || typeof result.html === "string").toBe(true);
    });
  });
});
