/**
 * Tests for json-file-cache.cjs
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  readJsonFileCached,
  readTextFileCached,
  clearJsonFileCache,
} = require("../server/lib/json-file-cache.cjs");

describe("json-file-cache", () => {
  let tmpDir;
  let jsonFile;
  let textFile;

  beforeEach(() => {
    clearJsonFileCache();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jfc-test-"));
    jsonFile = path.join(tmpDir, "test.json");
    textFile = path.join(tmpDir, "test.txt");
    fs.writeFileSync(jsonFile, JSON.stringify({ foo: "bar" }), "utf8");
    fs.writeFileSync(textFile, "hello world", "utf8");
  });

  afterEach(() => {
    clearJsonFileCache();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("readJsonFileCached", () => {
    test("reads and caches JSON file", () => {
      const val1 = readJsonFileCached(jsonFile);
      expect(val1).toEqual({ foo: "bar" });

      const val2 = readJsonFileCached(jsonFile);
      expect(val2).toBe(val1); // same cached object reference
    });

    test("picks up file change after cache clear", () => {
      readJsonFileCached(jsonFile);
      fs.writeFileSync(jsonFile, JSON.stringify({ foo: "baz" }), "utf8");
      clearJsonFileCache();
      const val = readJsonFileCached(jsonFile);
      expect(val).toEqual({ foo: "baz" });
    });

    test("returns null for missing file", () => {
      expect(readJsonFileCached(path.join(tmpDir, "no-such.json"))).toBeNull();
    });

    test("returns null for empty path", () => {
      expect(readJsonFileCached("")).toBeNull();
      expect(readJsonFileCached(null)).toBeNull();
    });

    test("returns null for invalid JSON", () => {
      const badFile = path.join(tmpDir, "bad.json");
      fs.writeFileSync(badFile, "not json", "utf8");
      expect(readJsonFileCached(badFile)).toBeNull();
    });
  });

  describe("readTextFileCached", () => {
    test("reads and caches text file", () => {
      const val1 = readTextFileCached(textFile);
      expect(val1).toBe("hello world");

      const val2 = readTextFileCached(textFile);
      expect(val2).toBe(val1); // same cached string reference
    });

    test("returns null for missing file", () => {
      expect(readTextFileCached(path.join(tmpDir, "no-such.txt"))).toBeNull();
    });

    test("returns null for empty path", () => {
      expect(readTextFileCached("")).toBeNull();
      expect(readTextFileCached(null)).toBeNull();
    });
  });

  describe("clearJsonFileCache", () => {
    test("clears all entries", () => {
      readJsonFileCached(jsonFile);
      readTextFileCached(textFile);
      clearJsonFileCache();

      fs.writeFileSync(jsonFile, JSON.stringify({ foo: "new" }), "utf8");
      fs.writeFileSync(textFile, "new text", "utf8");

      expect(readJsonFileCached(jsonFile)).toEqual({ foo: "new" });
      expect(readTextFileCached(textFile)).toBe("new text");
    });
  });
});
