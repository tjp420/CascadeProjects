const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  tokenize,
  buildIdf,
  embedPassage,
  cosineSimilarity,
  splitPassages,
  buildIndex,
  search,
  saveIndex,
  loadIndex,
  defaultIndexPath,
  serializeVector,
  deserializeVector,
} = require("../src/lib/embeddings-index");

test("tokenize lowercases and splits terms", () => {
  const tokens = tokenize("FooBar baz_qux 123");
  assert.ok(tokens.has("foo"));
  assert.ok(tokens.has("bar"));
  assert.ok(tokens.has("baz"));
  assert.ok(tokens.has("qux"));
  assert.ok(!tokens.has("123"), "pure numbers should be dropped");
});

test("tokenize handles empty input", () => {
  const tokens = tokenize("");
  assert.equal(tokens.size, 0);
});

test("buildIdf produces positive weights", () => {
  const idf = buildIdf(["foo bar", "foo baz"]);
  assert.ok(idf.get("foo") > 0);
  assert.ok(idf.get("bar") > 0);
  assert.ok(idf.get("baz") > 0);
  // 'foo' appears in both docs -> lower idf than 'bar' (one doc)
  assert.ok(idf.get("foo") < idf.get("bar"), "common term should have lower idf");
});

test("embedPassage returns normalized vector", () => {
  const idf = buildIdf(["foo bar baz"]);
  const { vector, terms } = embedPassage("foo bar", idf, 64);
  assert.equal(vector.length, 64);
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  assert.ok(Math.abs(Math.sqrt(norm) - 1) < 1e-4, "vector should be L2-normalized");
  assert.ok(terms.has("foo"));
});

test("cosineSimilarity of identical vectors is 1", () => {
  const idf = buildIdf(["foo bar"]);
  const { vector } = embedPassage("foo bar", idf, 32);
  assert.ok(Math.abs(cosineSimilarity(vector, vector) - 1) < 1e-4);
});

test("cosineSimilarity of orthogonal-ish different content is lower than same content", () => {
  const idf = buildIdf(["foo bar", "baz qux"]);
  const a = embedPassage("foo bar", idf, 128).vector;
  const b = embedPassage("baz qux", idf, 128).vector;
  const same = cosineSimilarity(a, a);
  const diff = cosineSimilarity(a, b);
  assert.ok(diff < same, "different content should score lower than identical");
});

test("splitPassages respects maxChars", () => {
  const content = "x".repeat(3000);
  const passages = splitPassages(content, { maxChars: 1000, overlap: 100 });
  assert.ok(passages.length > 1);
  for (const p of passages) {
    assert.ok(p.text.length <= 1100, "passage should be near maxChars");
  }
});

test("splitPassages handles short content", () => {
  const passages = splitPassages("short content", { maxChars: 1000, overlap: 100 });
  assert.equal(passages.length, 1);
});

test("buildIndex + search returns relevant file first", () => {
  const files = [
    { path: "redis.js", content: "function createRateLimiter(redis) { return redisStore; }", summary: "rate limiter redis" },
    { path: "auth.js", content: "function login(user, password) { return token; }", summary: "auth login" },
    { path: "utils.js", content: "function debounce(fn, ms) { return throttled; }", summary: "debounce utils" },
  ];
  const index = buildIndex(files, { dimensions: 128 });
  const results = search(index, "rate limiter redis", { k: 2 });
  assert.ok(results.length > 0);
  assert.equal(results[0].path, "redis.js", "most relevant file should rank first");
});

test("search returns empty for empty query", () => {
  const index = buildIndex([{ path: "a.js", content: "foo bar" }], { dimensions: 32 });
  assert.deepEqual(search(index, "", { k: 5 }), []);
});

test("search returns empty for empty index", () => {
  const index = buildIndex([], { dimensions: 32 });
  assert.deepEqual(search(index, "foo", { k: 5 }), []);
});

test("serializeVector + deserializeVector roundtrip", () => {
  const vec = new Float32Array([1, -1, 0.5, -0.5]);
  const b64 = serializeVector(vec);
  const back = deserializeVector(b64);
  assert.equal(back.length, 4);
  assert.equal(back[0], 1);
  assert.equal(back[1], -1);
  assert.ok(Math.abs(back[2] - 0.5) < 1e-6);
});

test("saveIndex + loadIndex roundtrip", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-emb-"));
  const indexPath = path.join(dir, "emb.json");
  const index = buildIndex([{ path: "a.js", content: "foo bar baz" }], { dimensions: 32 });
  saveIndex(index, indexPath);
  const loaded = loadIndex(indexPath);
  assert.ok(loaded);
  assert.equal(loaded.fileCount, 1);
  assert.equal(loaded.dimensions, 32);
  // search works on loaded index
  const results = search(loaded, "foo", { k: 1 });
  assert.equal(results.length, 1);
});

test("loadIndex returns null for missing file", () => {
  const loaded = loadIndex(path.join(os.tmpdir(), "nope-" + Date.now() + ".json"));
  assert.equal(loaded, null);
});

test("defaultIndexPath ends with embeddings dir + db name", () => {
  const p = defaultIndexPath("/tmp/proj");
  assert.ok(p.includes("embeddings"));
  assert.ok(p.endsWith("emb.db.json"));
});

test("buildIndex is deterministic — same input yields same search ranking", () => {
  const files = [
    { path: "a.js", content: "rate limiter redis store" },
    { path: "b.js", content: "auth login token" },
  ];
  const index1 = buildIndex(files, { dimensions: 64 });
  const index2 = buildIndex(files, { dimensions: 64 });
  const r1 = search(index1, "redis", { k: 2 }).map((r) => r.path);
  const r2 = search(index2, "redis", { k: 2 }).map((r) => r.path);
  assert.deepEqual(r1, r2, "should be deterministic");
});
