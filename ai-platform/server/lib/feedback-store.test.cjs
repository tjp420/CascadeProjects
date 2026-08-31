"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const STORE_DIR = path.join(os.tmpdir(), `sb-feedback-test-${Date.now()}`);
const STORE_PATH = path.join(STORE_DIR, "feedback.json");

process.env.FEEDBACK_STORE_PATH = STORE_PATH;

describe("feedback-store", () => {
  let feedbackStore;

  beforeEach(() => {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
    delete require.cache[require.resolve("../lib/feedback-store.cjs")];
    feedbackStore = require("../lib/feedback-store.cjs");
  });

  afterEach(() => {
    if (fs.existsSync(STORE_DIR)) {
      try {
        fs.rmSync(STORE_DIR, { recursive: true });
      } catch (_) {}
    }
  });

  describe("addFeedback", () => {
    it("adds a feedback entry with valid fields", () => {
      const result = feedbackStore.addFeedback({
        name: "John Doe",
        email: "john@example.com",
        message: "Great product!",
        category: "praise",
        source: "reddit",
        tier: "developer",
      });
      assert.ok(result.success);
      assert.ok(result.id > 0);
    });

    it("rejects empty message", () => {
      const result = feedbackStore.addFeedback({
        name: "John",
        message: "",
        category: "bug",
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "message_required");
    });

    it("defaults category to other when invalid", () => {
      const result = feedbackStore.addFeedback({
        message: "test",
        category: "invalid_category",
      });
      assert.ok(result.success);
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].category, "other");
    });

    it("defaults status to new", () => {
      feedbackStore.addFeedback({ message: "test", category: "bug" });
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].status, "new");
    });

    it("defaults source to other when not specified", () => {
      feedbackStore.addFeedback({ message: "test" });
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].source, "other");
    });

    it("increments ID for each entry", () => {
      const r1 = feedbackStore.addFeedback({ message: "first" });
      const r2 = feedbackStore.addFeedback({ message: "second" });
      assert.ok(r2.id > r1.id);
    });
  });

  describe("listFeedback", () => {
    it("returns empty list when no entries exist", () => {
      const result = feedbackStore.listFeedback();
      assert.strictEqual(result.entries.length, 0);
      assert.strictEqual(result.total, 0);
    });

    it("returns entries sorted newest first", () => {
      feedbackStore.addFeedback({ message: "first", category: "bug" });
      feedbackStore.addFeedback({ message: "second", category: "feature" });
      const result = feedbackStore.listFeedback();
      assert.strictEqual(result.entries.length, 2);
      assert.ok(result.entries[0].id > result.entries[1].id);
    });

    it("filters by category", () => {
      feedbackStore.addFeedback({ message: "a", category: "bug" });
      feedbackStore.addFeedback({ message: "b", category: "feature" });
      feedbackStore.addFeedback({ message: "c", category: "bug" });
      const result = feedbackStore.listFeedback({ category: "bug" });
      assert.strictEqual(result.entries.length, 2);
      assert.strictEqual(result.total, 2);
    });

    it("filters by status", () => {
      feedbackStore.addFeedback({ message: "a", category: "bug" });
      feedbackStore.addFeedback({ message: "b", category: "bug" });
      const all = feedbackStore.listFeedback();
      const id = all.entries[0].id;
      feedbackStore.updateFeedback(id, { status: "resolved" });
      const newOnly = feedbackStore.listFeedback({ status: "new" });
      const resolvedOnly = feedbackStore.listFeedback({ status: "resolved" });
      assert.strictEqual(newOnly.entries.length, 1);
      assert.strictEqual(resolvedOnly.entries.length, 1);
    });

    it("filters by source", () => {
      feedbackStore.addFeedback({ message: "a", source: "reddit" });
      feedbackStore.addFeedback({ message: "b", source: "hackernews" });
      const result = feedbackStore.listFeedback({ source: "reddit" });
      assert.strictEqual(result.entries.length, 1);
    });

    it("returns stats breakdown", () => {
      feedbackStore.addFeedback({ message: "a", category: "bug", source: "reddit" });
      feedbackStore.addFeedback({ message: "b", category: "feature", source: "hackernews" });
      feedbackStore.addFeedback({ message: "c", category: "bug", source: "email" });
      const result = feedbackStore.listFeedback();
      assert.strictEqual(result.stats.total, 3);
      assert.strictEqual(result.stats.byCategory.bug, 2);
      assert.strictEqual(result.stats.byCategory.feature, 1);
      assert.strictEqual(result.stats.bySource.reddit, 1);
      assert.strictEqual(result.stats.bySource.hackernews, 1);
      assert.strictEqual(result.stats.bySource.email, 1);
      assert.strictEqual(result.stats.byStatus.new, 3);
    });

    it("paginates results", () => {
      for (let i = 0; i < 5; i++) {
        feedbackStore.addFeedback({ message: `msg ${i}` });
      }
      const page1 = feedbackStore.listFeedback({ limit: 2, offset: 0 });
      const page2 = feedbackStore.listFeedback({ limit: 2, offset: 2 });
      assert.strictEqual(page1.entries.length, 2);
      assert.strictEqual(page2.entries.length, 2);
      assert.ok(page1.entries[0].id > page2.entries[0].id);
    });
  });

  describe("updateFeedback", () => {
    it("updates status", () => {
      const add = feedbackStore.addFeedback({ message: "test", category: "bug" });
      const result = feedbackStore.updateFeedback(add.id, { status: "triaged" });
      assert.ok(result.success);
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].status, "triaged");
    });

    it("updates admin notes", () => {
      const add = feedbackStore.addFeedback({ message: "test" });
      feedbackStore.updateFeedback(add.id, { adminNotes: "Need to investigate" });
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].adminNotes, "Need to investigate");
    });

    it("recategorizes", () => {
      const add = feedbackStore.addFeedback({ message: "test", category: "bug" });
      feedbackStore.updateFeedback(add.id, { category: "feature" });
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].category, "feature");
    });

    it("rejects invalid status", () => {
      const add = feedbackStore.addFeedback({ message: "test" });
      feedbackStore.updateFeedback(add.id, { status: "invalid_status" });
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries[0].status, "new");
    });

    it("returns error for non-existent ID", () => {
      const result = feedbackStore.updateFeedback(99999, { status: "resolved" });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "not_found");
    });
  });

  describe("deleteFeedback", () => {
    it("deletes an entry", () => {
      const add = feedbackStore.addFeedback({ message: "delete me" });
      const result = feedbackStore.deleteFeedback(add.id);
      assert.ok(result.success);
      const list = feedbackStore.listFeedback();
      assert.strictEqual(list.entries.length, 0);
    });

    it("returns error for non-existent ID", () => {
      const result = feedbackStore.deleteFeedback(99999);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "not_found");
    });
  });

  describe("constants", () => {
    it("exports valid categories", () => {
      assert.ok(Array.isArray(feedbackStore.VALID_CATEGORIES));
      assert.ok(feedbackStore.VALID_CATEGORIES.includes("bug"));
      assert.ok(feedbackStore.VALID_CATEGORIES.includes("feature"));
      assert.ok(feedbackStore.VALID_CATEGORIES.includes("praise"));
    });

    it("exports valid statuses", () => {
      assert.ok(Array.isArray(feedbackStore.VALID_STATUSES));
      assert.ok(feedbackStore.VALID_STATUSES.includes("new"));
      assert.ok(feedbackStore.VALID_STATUSES.includes("resolved"));
      assert.ok(feedbackStore.VALID_STATUSES.includes("wont_fix"));
    });

    it("exports valid sources", () => {
      assert.ok(Array.isArray(feedbackStore.VALID_SOURCES));
      assert.ok(feedbackStore.VALID_SOURCES.includes("reddit"));
      assert.ok(feedbackStore.VALID_SOURCES.includes("hackernews"));
      assert.ok(feedbackStore.VALID_SOURCES.includes("contact_form"));
    });
  });
});
