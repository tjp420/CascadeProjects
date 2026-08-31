"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const STORE_DIR = path.join(os.tmpdir(), `sb-token-seq-test-${Date.now()}`);
const SEQ_PATH = path.join(STORE_DIR, "token-sequences.json");

process.env.TOKEN_SEQ_STORE_PATH = SEQ_PATH;

describe("JsonFileTokenStore nextSequence", () => {
  let JsonFileTokenStore;

  beforeEach(() => {
    if (fs.existsSync(SEQ_PATH)) fs.unlinkSync(SEQ_PATH);
    delete require.cache[require.resolve("../lib/token-store-adapter.cjs")];
    JsonFileTokenStore = require("../lib/token-store-adapter.cjs").JsonFileTokenStore;
  });

  afterEach(() => {
    if (fs.existsSync(STORE_DIR)) {
      try { fs.rmSync(STORE_DIR, { recursive: true }); } catch (_) {}
    }
  });

  it("returns incrementing sequence numbers for the same tenant", () => {
    const store = new JsonFileTokenStore();
    const s1 = store.nextSequence("tenant-a");
    const s2 = store.nextSequence("tenant-a");
    const s3 = store.nextSequence("tenant-a");
    assert.ok(s1 > 0, "first sequence should be positive");
    assert.strictEqual(s2, s1 + 1);
    assert.strictEqual(s3, s2 + 1);
  });

  it("maintains independent sequences per tenant", () => {
    const store = new JsonFileTokenStore();
    const a1 = store.nextSequence("tenant-a");
    const b1 = store.nextSequence("tenant-b");
    const a2 = store.nextSequence("tenant-a");
    const b2 = store.nextSequence("tenant-b");
    assert.strictEqual(a2, a1 + 1);
    assert.strictEqual(b2, b1 + 1);
    // Both start at 1, but increment independently
    assert.strictEqual(a1, b1); // both are 1
    assert.strictEqual(a2, 2);
    assert.strictEqual(b2, 2);
  });

  it("defaults to 'default' tenant when no tenantId provided", () => {
    const store = new JsonFileTokenStore();
    const s = store.nextSequence();
    assert.ok(s > 0);
  });

  it("persists sequences across store instances", () => {
    const store1 = new JsonFileTokenStore();
    store1.nextSequence("tenant-x");
    store1.nextSequence("tenant-x");

    // Create a new store instance — should read from the same file
    delete require.cache[require.resolve("../lib/token-store-adapter.cjs")];
    const { JsonFileTokenStore: FreshStore } = require("../lib/token-store-adapter.cjs");
    const store2 = new FreshStore();
    const s = store2.nextSequence("tenant-x");
    assert.strictEqual(s, 3);
  });

  it("handles empty/null tenantId gracefully", () => {
    const store = new JsonFileTokenStore();
    const s = store.nextSequence(null);
    assert.ok(s > 0);
  });
});
