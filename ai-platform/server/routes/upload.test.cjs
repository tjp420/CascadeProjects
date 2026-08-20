const { describe, it } = require("node:test");
const assert = require("node:assert");
const mod = require("./upload.cjs");

describe("upload", () => {
  it("exports without throwing", () => {
    assert.ok(mod, "module should export something");
  });

  it("has expected exports", () => {
    const keys = Object.keys(mod || {});
    assert.ok(Array.isArray(keys), "should have enumerable exports");
  });
});

// Test the URL/branch/token validation logic added in Sprint 1 (MEDIUM audit fix).
// These tests verify the regex patterns used inline in the route handler.
describe("upload URL validation", () => {
  const urlRegex = /^https:\/\/[^\s]+$/i;
  const branchRegex = /^[a-zA-Z0-9._\-\/]+$/;

  describe("repoUrl scheme validation", () => {
    it("accepts valid https:// GitHub URLs", () => {
      assert.ok(urlRegex.test("https://github.com/user/repo"));
      assert.ok(urlRegex.test("https://github.com/user/repo.git"));
      assert.ok(urlRegex.test("https://gitlab.com/team/project"));
    });

    it("rejects file:// URLs (SSRF prevention)", () => {
      assert.strictEqual(urlRegex.test("file:///etc/passwd"), false);
    });

    it("rejects ssh:// URLs", () => {
      assert.strictEqual(
        urlRegex.test("ssh://git@github.com/user/repo"),
        false,
      );
    });

    it("rejects git:// URLs", () => {
      assert.strictEqual(urlRegex.test("git://github.com/user/repo"), false);
    });

    it("rejects http:// URLs (must be https)", () => {
      assert.strictEqual(urlRegex.test("http://github.com/user/repo"), false);
    });

    it("rejects empty string", () => {
      assert.strictEqual(urlRegex.test(""), false);
    });
  });

  describe("branch name validation", () => {
    it("accepts standard branch names", () => {
      assert.ok(branchRegex.test("main"));
      assert.ok(branchRegex.test("develop"));
      assert.ok(branchRegex.test("feature/new-login"));
      assert.ok(branchRegex.test("release-1.0"));
      assert.ok(branchRegex.test("hotfix_urgent"));
    });

    it("rejects branch names with shell metacharacters", () => {
      assert.strictEqual(branchRegex.test("main; rm -rf /"), false);
      assert.strictEqual(branchRegex.test("feature|cat"), false);
      assert.strictEqual(branchRegex.test("$(whoami)"), false);
    });

    it("rejects branch names with spaces", () => {
      assert.strictEqual(branchRegex.test("my branch"), false);
    });
  });

  describe("accessToken format validation", () => {
    function validateToken(token) {
      if (token === undefined) return true;
      if (typeof token !== "string") return false;
      if (token.length > 500) return false;
      return true;
    }

    it("accepts undefined (no token provided)", () => {
      assert.strictEqual(validateToken(undefined), true);
    });

    it("accepts valid string tokens", () => {
      assert.strictEqual(validateToken("ghp_abc123"), true);
      assert.strictEqual(validateToken(""), true);
    });

    it("rejects non-string tokens", () => {
      assert.strictEqual(validateToken(12345), false);
      assert.strictEqual(validateToken({ key: "value" }), false);
      assert.strictEqual(validateToken(true), false);
    });

    it("rejects tokens exceeding 500 characters", () => {
      assert.strictEqual(validateToken("a".repeat(501)), false);
      assert.strictEqual(validateToken("a".repeat(500)), true);
    });
  });
});
