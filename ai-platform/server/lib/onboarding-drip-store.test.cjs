"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const STORE_DIR = path.join(os.tmpdir(), `sb-drip-test-${Date.now()}`);
const STORE_PATH = path.join(STORE_DIR, "onboarding-drip.json");

// Set the env var before requiring the module
process.env.ONBOARDING_DRIP_STORE = STORE_PATH;

const {
  registerActivation,
  findDueUsers,
  markStepSent,
  removeUser,
  readDripStore,
} = require("../lib/onboarding-drip-store.cjs");

describe("onboarding-drip-store", () => {
  beforeEach(() => {
    // Clear the cache and any existing store
    if (fs.existsSync(STORE_PATH)) {
      fs.unlinkSync(STORE_PATH);
    }
    // Force re-read by clearing the module's internal cache
    // We do this by requiring a fresh instance
    delete require.cache[require.resolve("../lib/onboarding-drip-store.cjs")];
  });

  afterEach(() => {
    if (fs.existsSync(STORE_DIR)) {
      try {
        fs.rmSync(STORE_DIR, { recursive: true });
      } catch (_) {}
    }
  });

  describe("registerActivation", () => {
    it("registers a new user with activation timestamp", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      const store = freshModule.readDripStore();
      assert.ok(store.users["test@example.com"]);
      assert.strictEqual(store.users["test@example.com"].tier, "developer");
      assert.ok(store.users["test@example.com"].activatedAt);
      assert.deepStrictEqual(store.users["test@example.com"].sentSteps, []);
    });

    it("normalizes email to lowercase", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("Test.User@Example.COM", "developer");
      const store = freshModule.readDripStore();
      assert.ok(store.users["test.user@example.com"]);
    });

    it("preserves activatedAt on re-registration", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      const firstStore = freshModule.readDripStore();
      const firstActivated = firstStore.users["test@example.com"].activatedAt;

      // Wait a moment, then re-register
      const freshModule2 = require("../lib/onboarding-drip-store.cjs");
      // Re-register with the same store path
      freshModule2.registerActivation("test@example.com", "team_pro");
      const store = freshModule2.readDripStore();
      // activatedAt should be preserved from the first registration
      assert.strictEqual(store.users["test@example.com"].activatedAt, firstActivated);
      // But tier should update
      assert.strictEqual(store.users["test@example.com"].tier, "team_pro");
    });

    it("ignores empty email", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("", "developer");
      const store = freshModule.readDripStore();
      assert.strictEqual(Object.keys(store.users).length, 0);
    });
  });

  describe("findDueUsers", () => {
    it("returns users past the minimum hours threshold", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      // Register a user with an old activation date
      const oldDate = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30h ago
      freshModule.registerActivation("old@example.com", "developer");
      // Manually set the activatedAt to 30h ago
      const store = freshModule.readDripStore();
      store.users["old@example.com"].activatedAt = oldDate;
      // Write it back by re-registering (which preserves activatedAt)
      // Actually we need to manipulate the store directly — use the module's write
      // Since registerActivation preserves existing activatedAt, we can just
      // set it by first registering, then modifying the file
      const fs2 = require("fs");
      const path2 = require("path");
      const raw = fs2.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      parsed.users["old@example.com"].activatedAt = oldDate;
      fs2.writeFileSync(STORE_PATH, JSON.stringify(parsed, null, 2));
      // Clear cache in the module
      delete require.cache[require.resolve("../lib/onboarding-drip-store.cjs")];
      const freshModule2 = require("../lib/onboarding-drip-store.cjs");

      const due = freshModule2.findDueUsers(1, 24); // step 1, 24h minimum
      assert.ok(due.length >= 1);
      const oldUser = due.find((u) => u.email === "old@example.com");
      assert.ok(oldUser);
      assert.strictEqual(oldUser.stepNumber, 1);
    });

    it("excludes users who already received the step", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("sent@example.com", "developer");
      freshModule.markStepSent("sent@example.com", 1);
      const due = freshModule.findDueUsers(1, 0); // 0 hours = everyone due
      const sent = due.find((u) => u.email === "sent@example.com");
      assert.ok(!sent);
    });

    it("returns empty array when no users registered", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      const due = freshModule.findDueUsers(1, 24);
      assert.strictEqual(due.length, 0);
    });
  });

  describe("markStepSent", () => {
    it("marks a step as sent", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      freshModule.markStepSent("test@example.com", 1);
      const store = freshModule.readDripStore();
      assert.ok(store.users["test@example.com"].sentSteps.includes("step1"));
    });

    it("does not duplicate step entries", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      freshModule.markStepSent("test@example.com", 1);
      freshModule.markStepSent("test@example.com", 1);
      const store = freshModule.readDripStore();
      const count = store.users["test@example.com"].sentSteps.filter(
        (s) => s === "step1",
      ).length;
      assert.strictEqual(count, 1);
    });

    it("ignores unknown users", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.markStepSent("nobody@example.com", 1);
      const store = freshModule.readDripStore();
      assert.ok(!store.users["nobody@example.com"]);
    });
  });

  describe("removeUser", () => {
    it("removes a user from the store", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("remove@example.com", "developer");
      freshModule.removeUser("remove@example.com");
      const store = freshModule.readDripStore();
      assert.ok(!store.users["remove@example.com"]);
    });

    it("is a no-op for unknown users", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.removeUser("nobody@example.com");
      const store = freshModule.readDripStore();
      assert.ok(!store.users["nobody@example.com"]);
    });
  });

  describe("listAllUsers", () => {
    it("returns empty array when no users registered", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      const users = freshModule.listAllUsers();
      assert.strictEqual(users.length, 0);
    });

    it("returns all registered users with their fields", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("alice@example.com", "developer");
      freshModule.registerActivation("bob@example.com", "team_pro");
      const users = freshModule.listAllUsers();
      assert.strictEqual(users.length, 2);
      const alice = users.find((u) => u.email === "alice@example.com");
      assert.ok(alice);
      assert.strictEqual(alice.tier, "developer");
      assert.ok(alice.activatedAt);
      assert.deepStrictEqual(alice.sentSteps, []);
    });
  });

  describe("resetStep", () => {
    it("removes a step from sentSteps", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      freshModule.markStepSent("test@example.com", 1);
      freshModule.markStepSent("test@example.com", 2);
      const result = freshModule.resetStep("test@example.com", 1);
      assert.ok(result.success);
      const store = freshModule.readDripStore();
      assert.ok(!store.users["test@example.com"].sentSteps.includes("step1"));
      assert.ok(store.users["test@example.com"].sentSteps.includes("step2"));
    });

    it("returns error for non-existent user", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      const result = freshModule.resetStep("nobody@example.com", 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "not_found");
    });

    it("returns error for empty email", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      const result = freshModule.resetStep("", 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "email_required");
    });
  });

  describe("skipStep", () => {
    it("marks a step as sent without sending", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      const result = freshModule.skipStep("test@example.com", 2);
      assert.ok(result.success);
      const store = freshModule.readDripStore();
      assert.ok(store.users["test@example.com"].sentSteps.includes("step2"));
    });

    it("does not duplicate when skipping already-sent step", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      freshModule.registerActivation("test@example.com", "developer");
      freshModule.markStepSent("test@example.com", 1);
      freshModule.skipStep("test@example.com", 1);
      const store = freshModule.readDripStore();
      const count = store.users["test@example.com"].sentSteps.filter(
        (s) => s === "step1",
      ).length;
      assert.strictEqual(count, 1);
    });

    it("returns error for non-existent user", () => {
      const freshModule = require("../lib/onboarding-drip-store.cjs");
      const result = freshModule.skipStep("nobody@example.com", 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "not_found");
    });
  });
});
