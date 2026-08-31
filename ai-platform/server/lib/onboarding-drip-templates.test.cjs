"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  renderOnboardingDay1,
  renderOnboardingDay3,
  renderOnboardingDay7,
} = require("../lib/billing-email-templates.cjs");

describe("onboarding drip templates", () => {
  describe("renderOnboardingDay1", () => {
    it("returns subject, text, and html", () => {
      const result = renderOnboardingDay1({ tier: "developer" });
      assert.ok(typeof result.subject === "string" && result.subject.length > 0);
      assert.ok(typeof result.text === "string" && result.text.length > 0);
      assert.ok(typeof result.html === "string" && result.html.length > 0);
    });

    it("html has branded layout with header and footer", () => {
      const result = renderOnboardingDay1({ tier: "developer" });
      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("SimpleBeacon"));
      assert.ok(result.html.includes("header"));
      assert.ok(result.html.includes("footer"));
    });

    it("includes quickstart tips in text body", () => {
      const result = renderOnboardingDay1({ tier: "developer" });
      assert.ok(result.text.includes("--gate"));
      assert.ok(result.text.includes("--anonymize"));
      assert.ok(result.text.includes("VS Code"));
    });

    it("includes code blocks in html", () => {
      const result = renderOnboardingDay1({ tier: "developer" });
      assert.ok(result.html.includes("code-block"));
      assert.ok(result.html.includes("--gate"));
    });

    it("personalizes greeting with first name from email", () => {
      const result = renderOnboardingDay1({
        tier: "developer",
        customerEmail: "john.doe@example.com",
      });
      assert.ok(result.text.includes("Hi john"));
      assert.ok(result.html.includes("Hi john"));
    });

    it("falls back to 'there' when no email provided", () => {
      const result = renderOnboardingDay1({ tier: "developer" });
      assert.ok(result.text.includes("Hi there"));
    });

    it("includes tier name in text", () => {
      const result = renderOnboardingDay1({ tier: "team_pro" });
      assert.ok(result.text.includes("Team Pro"));
    });
  });

  describe("renderOnboardingDay3", () => {
    it("returns subject, text, and html", () => {
      const result = renderOnboardingDay3({ tier: "developer" });
      assert.ok(typeof result.subject === "string" && result.subject.length > 0);
      assert.ok(typeof result.text === "string" && result.text.length > 0);
      assert.ok(typeof result.html === "string" && result.html.length > 0);
    });

    it("html has branded layout", () => {
      const result = renderOnboardingDay3({ tier: "developer" });
      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("SimpleBeacon"));
    });

    it("mentions PDF certificates, compliance, and pre-commit hook", () => {
      const result = renderOnboardingDay3({ tier: "developer" });
      assert.ok(result.text.includes("pdf"));
      assert.ok(result.text.includes("compliance"));
      assert.ok(result.text.includes("hook install"));
    });

    it("includes local-first callout in html", () => {
      const result = renderOnboardingDay3({ tier: "developer" });
      assert.ok(result.html.includes("callout-info"));
      assert.ok(result.html.includes("locally"));
    });

    it("personalizes greeting", () => {
      const result = renderOnboardingDay3({
        tier: "developer",
        customerEmail: "jane@example.com",
      });
      assert.ok(result.text.includes("Hi jane"));
    });
  });

  describe("renderOnboardingDay7", () => {
    it("returns subject, text, and html", () => {
      const result = renderOnboardingDay7({ tier: "developer" });
      assert.ok(typeof result.subject === "string" && result.subject.length > 0);
      assert.ok(typeof result.text === "string" && result.text.length > 0);
      assert.ok(typeof result.html === "string" && result.html.length > 0);
    });

    it("html has branded layout", () => {
      const result = renderOnboardingDay7({ tier: "developer" });
      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("SimpleBeacon"));
    });

    it("includes install and scan commands", () => {
      const result = renderOnboardingDay7({ tier: "developer" });
      assert.ok(result.text.includes("npm install -g simplebeacon"));
      assert.ok(result.text.includes("simplebeacon scan"));
    });

    it("includes founder signature", () => {
      const result = renderOnboardingDay7({ tier: "developer" });
      assert.ok(result.text.includes("Trevor"));
      assert.ok(result.text.includes("Founder"));
    });

    it("includes tier name in subject", () => {
      const result = renderOnboardingDay7({ tier: "team_pro" });
      assert.ok(result.subject.includes("Team Pro"));
    });

    it("personalizes greeting", () => {
      const result = renderOnboardingDay7({
        tier: "developer",
        customerEmail: "bob@example.com",
      });
      assert.ok(result.text.includes("Hi bob"));
    });
  });

  describe("all drip templates share consistent layout", () => {
    const templates = [
      { name: "day1", fn: () => renderOnboardingDay1({ tier: "developer" }) },
      { name: "day3", fn: () => renderOnboardingDay3({ tier: "developer" }) },
      { name: "day7", fn: () => renderOnboardingDay7({ tier: "developer" }) },
    ];

    for (const { name, fn } of templates) {
      it(`${name} returns all three fields`, () => {
        const result = fn();
        assert.ok(result.subject && result.subject.length > 0);
        assert.ok(result.text && result.text.length > 0);
        assert.ok(result.html && result.html.length > 0);
      });

      it(`${name} html has DOCTYPE and brand`, () => {
        const result = fn();
        assert.ok(result.html.includes("<!DOCTYPE html>"));
        assert.ok(result.html.includes("SimpleBeacon"));
        assert.ok(result.html.includes("header"));
        assert.ok(result.html.includes("footer"));
      });
    }
  });
});
